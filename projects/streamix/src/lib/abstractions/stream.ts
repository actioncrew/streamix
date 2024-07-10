import { Promisified } from './../utils/promisified';
import { Emission } from './emission';
import { AbstractOperator } from './operator';
import { StreamSink } from './sink';
import { Subscription } from './subscription';

export abstract class AbstractStream {

  isAutoComplete: boolean = false;
  isCancelled: boolean = false;
  isStopRequested: boolean = false;

  isFailed = new Promisified<Error>(undefined);
  isStopped = new Promisified<boolean>(false);
  isUnsubscribed =  new Promisified<boolean>(false);

  protected subscribers: ((value: any) => any)[] = [];
  protected head?: AbstractOperator;
  protected tail?: AbstractOperator;

  public async emit(emission: Emission): Promise<void> {
    if (this.isCancelled || this.isStopRequested) {
      return;
    }

    try {
      if (this.head) {
        emission = await this.head.process(emission, this);
      }

      if (!emission.isPhantom && !emission.isCancelled && !emission.isFailed) {
        await Promise.all(this.subscribers.map(subscriber => subscriber(emission.value)));
        emission.isComplete = true;
      }
    } catch (error: any) {
      console.error(`Error in stream ${this.constructor.name}: `, error);
      emission.isFailed = true;
      emission.error = error;
      this.isFailed.resolve(error);
    }
  }

  cancel(): Promise<void> {
    this.isCancelled = true;
    return this.isStopped.promise.then(() => Promise.resolve());
  }

  complete(): Promise<void> {
    this.isStopRequested = true;
    return this.isStopped.promise.then(() => Promise.resolve());
  }

  pipe(...operators: AbstractOperator[]): AbstractStream {
    const newStream = new StreamSink(this);

    for (const operator of operators) {
      if (!newStream.head) {
        newStream.head = operator;
        newStream.tail = operator;
      } else {
        newStream.tail!.next = operator;
        newStream.tail = operator;
      }
    }

    return newStream;
  }

  abstract run(): Promise<void>;

  protected unsubscribe(callback: (value: any) => any): void {
    this.subscribers = this.subscribers.filter(subscriber => subscriber !== callback);
    if (this.subscribers.length === 0) {
      this.isStopRequested = true;
      this.isUnsubscribed.resolve(true);
    }
  }

  subscribe(callback: (value: any) => any): Subscription {
    this.subscribers.push(callback);

    // Start or resume the stream
    if(this.subscribers.length == 1) {
      queueMicrotask(() => this.run()
      .then(() => this.isStopped.resolve(true))
      .catch((error) => this.isFailed.resolve(error)));
    }

    return { unsubscribe: () => this.unsubscribe(callback) };
  }
}
