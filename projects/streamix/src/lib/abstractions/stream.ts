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
      this.isStopped.resolve(true);
    }
  }

  cancel(): Promise<void> {
    this.isCancelled.resolve(true);
    return this.isStopped.then(() => Promise.resolve());
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

      if (this.source.isCancelled.value) {
        emission.isCancelled = true;
        return;
      }

      let currentEmission: Emission = emission;
      let promise = this.head?.process(currentEmission, this) ?? Promise.resolve(currentEmission);

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

  split(operator: AbstractOperator, stream: AbstractStream) {
    let subscribers: ((value: any) => any)[] = [];
    this.left = new StreamSink(new Proxy(this.source, {
      get: (target: AbstractStream, prop: string, receiver: any) => {
        if (prop === 'subscribers') {
          // Return a custom value or handle the subscribers property
          return subscribers;
        }
        return Reflect.get(target, prop, receiver);
      },
      set: (target: AbstractStream, prop: string, value: any, receiver: any) => {
        if (prop === 'subscribers') {
          // Handle setting the subscribers property
          subscribers = value;
          return true;
        }
        return Reflect.set(target, prop, value, receiver);
      }
    }));

    this.left.head = this.head; this.left.tail = operator;
    const callback = () => {}; this.left.subscribers.push(callback);

    this.right = new StreamSink(stream);
    this.right.subscribe(callback); //starting stream
    this.right.subscribers = new Proxy(this.subscribers, {
      get: (target: any[], prop: string, receiver: any) => {
        if (prop === 'subscribers') {
          return this.subscribers;
        }

        return Reflect.get(target, prop, receiver);
      },
      set: (target: any[], prop: string, value: any, receiver: any) => {
        if (prop === 'subscribers') {
          this.subscribers = value;
          return true;
        }
        return Reflect.set(target, prop, value, receiver);
    }});

    this.right.unsubscribe = new Proxy(this.unsubscribe, {
      apply: (targetUnsubscribe, thisArg, argumentsList: any) => {
        targetUnsubscribe.apply(thisArg, argumentsList);
        if (this.subscribers.length === 0) {
          this.left!.unsubscribe(callback)
        }
      }
    });

    this.right.head = operator.next; this.right.tail = this.tail;

    this.isSplitted = true;
    return [this.left, this.right];
  }
}
