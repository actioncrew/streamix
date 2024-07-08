import { Promisified } from './../utils/promisified';
import { Emission } from './emission';
import { AbstractOperator } from './operator';
import { Subscription } from './subscription';

export abstract class AbstractStream {
  source: AbstractStream = this;

  isAutoComplete: boolean = false;
  isCancelled: boolean = false;
  isStopRequested: boolean = false;

  _isStopped = new Promisified<boolean>(false);
  _isUnsubscribed =  new Promisified<boolean>(false);

  get isUnsubscribed(): Promisified<boolean> {
    if (this.source === this) { return this._isUnsubscribed; }
    else return this.source._isUnsubscribed;
  }

  get isStopped(): Promisified<boolean> {
    if (this.source === this) { return this._isStopped; }
    else return this.source._isStopped;
  }

  protected subscribers: ((value: any) => any)[] = [];
  protected head?: AbstractOperator;
  protected tail?: AbstractOperator;

  protected async emit(emission: Emission): Promise<void> {
    try {
      let promise = this.head ? this.head.handle(emission, this.isCancelled) : Promise.resolve(emission);
      emission = await promise;

      if (emission.isPhantom || emission.isCancelled || emission.isFailed) {
        return;
      }

      await Promise.all(this.subscribers.map(subscriber => subscriber(emission.value)));
      emission.isComplete = true;

    } catch (error: any) {
      console.error(`Error in stream ${this.constructor.name}: `, error);
      emission.isFailed = true;
      emission.error = error;
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
    const newStream = Object.create(this) as AbstractStream;
    newStream.source = this;

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
    if (this.subscribers.length === 0 && !this.isAutoComplete) {
      this.isUnsubscribed.resolve(true);
    }
  }

  subscribe(callback: (value: any) => any): Subscription {
    this.subscribers.push(callback);

    // Start or resume the stream
    if(this.subscribers.length == 1) {
      queueMicrotask(() => this.run().then(() => this.isStopped.resolve(true)));
    }

    return { unsubscribe: () => this.unsubscribe(callback) };
  }
}
