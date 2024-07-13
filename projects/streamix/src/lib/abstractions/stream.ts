import { Promisified } from './../utils/promisified';
import { Emission } from './emission';
import { AbstractOperator } from './operator';
import { Subscription } from './subscription';

export class AbstractStream {

  isAutoComplete = new Promisified<boolean>(false);
  isCancelled = new Promisified<boolean>(false);
  isStopRequested = new Promisified<boolean>(false);

  isFailed = new Promisified<any>(undefined);
  isStopped = new Promisified<boolean>(false);
  isUnsubscribed = new Promisified<boolean>(false);

  protected subscribers: ((value: any) => any)[] = [];

  async emit(emission: Emission): Promise<void> {
    if (this.isCancelled.value) {
      emission.isCancelled = true;
      return;
    }

    try {
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
    this.isCancelled.resolve(true);
    return this.isStopped.promise.then(() => Promise.resolve());
  }

  complete(): Promise<void> {
    this.isStopRequested.resolve(true);
    return this.isStopped.promise.then(() => Promise.resolve());
  }

  pipe(...operators: AbstractOperator[]): AbstractStream {
    return new StreamSink(this).pipe(...operators);
  }

  run(): Promise<void> {
    throw new Error('Method is not implemented.');
  }

  protected unsubscribe(callback: (value: any) => any): void {
    this.subscribers = this.subscribers.filter(subscriber => subscriber !== callback);
    if (this.subscribers.length === 0) {
      this.isStopRequested.resolve(true);
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

export class StreamSink extends AbstractStream {
  protected source: AbstractStream;
  protected head?: AbstractOperator;
  protected tail?: AbstractOperator;

  protected sourceEmitter: AbstractStream;

  constructor(source: AbstractStream) {
    super();
    this.source = source;
    this.sourceEmitter = new Proxy(this.source, {
      get: (target, prop) => (prop === 'emit' ? this.emit.bind(this) : (target as any)[prop]),
    });
  }

  override cancel(): Promise<void> {
    this.source.isCancelled.resolve(true);
    return this.source.isStopped.promise.then(() => Promise.resolve());
  }

  override complete(): Promise<void> {
    this.source.isStopRequested.resolve(true);
    return this.source.isStopped.promise.then(() => Promise.resolve());
  }

  override pipe(...operators: AbstractOperator[]): AbstractStream {

    for (const operator of operators) {
      if (!this.head) {
        this.head = operator;
        this.tail = operator;
      } else {
        this.tail!.next = operator;
        this.tail = operator;
      }
    }

    return this;
  }

  override async run(): Promise<void> {
    return this.sourceEmitter.run();
  }

  override emit(emission: Emission): Promise<void> {
    try {
      if (this.source.isCancelled.value) {
        emission.isCancelled = true;
        return;
      }

      let currentEmission = emission;
      let promise = this.head ? this.head.process(currentEmission, this) : Promise.resolve(currentEmission);

      currentEmission = await promise;

      if (currentEmission.isPhantom || currentEmission.isCancelled || currentEmission.isFailed) {
        return;
      }

      await Promise.all(this.subscribers.map(subscriber => subscriber(currentEmission.value)));
      currentEmission.isComplete = true;
    } catch (error: any) {
      console.error(`Error in stream ${this.constructor.name}: `, error);
      emission.isFailed = true;
      emission.error = error;
    }
  }
}
