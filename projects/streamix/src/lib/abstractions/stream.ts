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
  isRunning = new Promisified<boolean>(false);

  protected subscribers: ((value: any) => any)[] = [];

  async emit(emission: Emission): Promise<void> {
    try {
      let currentEmission: Emission = emission;

      if (this.isCancelled.value) {
        currentEmission.isCancelled = true;
      }

      if (!(currentEmission.isPhantom || currentEmission.isCancelled || currentEmission.isFailed)) {
        await Promise.all(this.subscribers.map(subscriber => subscriber(currentEmission.value)));
      }

      currentEmission.isComplete = true;
    } catch (error: any) {
      console.error(`Error in stream ${this.constructor.name}: `, error);
      emission.isFailed = true;
      emission.error = error;
      this.isFailed.resolve(error);
      this.isStopped.resolve(true);
    }
  }

  shouldTerminate() {
    return this.isCancelled.value || this.isFailed.value;
  }

  awaitTermination() {
    return Promise.race([this.isCancelled.promise, this.isFailed.promise]);
  }

  terminate(): Promise<void> {
    this.isCancelled.resolve(true);
    return this.isStopped.then(() => Promise.resolve());
  }

  shouldComplete() {
    return this.isAutoComplete.value || this.isUnsubscribed.value || this.isStopRequested.value;
  }

  awaitCompletion() {
    return Promise.race([this.isAutoComplete.promise, this.isUnsubscribed.promise, this.isStopRequested.promise]);
  }

  complete(): Promise<void> {
    this.isStopRequested.resolve(true);
    return this.isStopped.then(() => Promise.resolve());
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
    if(this.subscribers.length == 1 && this.isRunning.value === false) {
      this.isRunning.resolve(true);
      queueMicrotask(() => this.run()
        .catch((error) => this.isFailed.resolve(error))
        .finally(() => {
          this.isStopped.resolve(true);
          this.isRunning.reset();
        }))
    }

    return { unsubscribe: () => this.unsubscribe(callback) };
  }
}

export class StreamSink extends AbstractStream {
  protected source: AbstractStream;
  protected head?: AbstractOperator;
  protected tail?: AbstractOperator;

  protected right?: StreamSink;
  protected left?: StreamSink;

  isSplitted: boolean = false;

  constructor(source: AbstractStream) {
    super();
    this.source = source;
    // Proxy all other properties and methods from source
    return new Proxy(this, {
      get: (target, prop) => {
        if (!(prop in this.source)) {
          return (this as any)[prop];
        } else if (prop in this && prop !== 'run') {
          return (this as any)[prop];
        } else {
          return (this.source as any)[prop];
        }
      },
      set: (target, prop, value) => {
        (this as any)[prop] = value;
        return true;
      }
    });
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

  override async emit(emission: Emission): Promise<void> {
    try {
      let currentEmission: Emission = emission;

      if (this.source.isCancelled.value) {
        currentEmission.isCancelled = true;
      }

      currentEmission = await (this.head?.process(currentEmission, this) ?? Promise.resolve(currentEmission));

      if (!(currentEmission.isPhantom || currentEmission.isCancelled || currentEmission.isFailed)) {
        await Promise.all(this.subscribers.map(subscriber => subscriber(currentEmission.value)));
      }

      currentEmission.isComplete = true;
    } catch (error: any) {
      console.error(`Error in stream ${this.constructor.name}: `, error);
      emission.isFailed = true;
      emission.error = error;
    }
  }

  split(operator: AbstractOperator, stream: AbstractStream) {
    let subscribers = this.source.subscribers.slice();
    const callback = () => {};
    this.source.subscribers = [callback];
    
    this.left = new StreamSink(this.source);
    this.left.head = this.head; this.left.tail = operator;

    this.right = new StreamSink(stream);
    this.right.head = operator.next; this.right.tail = this.tail;
    
    subscribers.forEach(subscriber => this.right.subscribe(subscriber));

    this.right.unsubscribe = new Proxy(this.unsubscribe, {
      apply: (targetUnsubscribe, thisArg, argumentsList: any) => {
        targetUnsubscribe.apply(thisArg, argumentsList);
        if (this.subscribers.length === 0) {
          this.left!.unsubscribe(callback)
        }
      }
    });

    this.isSplitted = true;
    return [this.left, this.right];
  }
}
