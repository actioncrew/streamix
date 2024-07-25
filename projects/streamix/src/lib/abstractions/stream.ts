import { CatchErrorHook } from '../hooks/catchError';
import { EndWithHook } from '../hooks/endWith';
import { FinalizeHook } from '../hooks/finalize';
import { StartWithHook } from '../hooks/startWith';
import { NoopHook } from './../hooks/noop';
import { Promisified } from './../utils/promisified';
import { Emission } from './emission';
import { AbstractHook } from './hook';
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

  protected subscribers: (((value: any) => any) | void)[] = [];

  protected onStart = new NoopHook();
  protected onComplete = new NoopHook();
  protected onStop = new NoopHook();
  protected onError = new NoopHook();

  async emit(emission: Emission): Promise<void> {
    try {
      let currentEmission: Emission = emission;

      if (this.isCancelled.value) {
        currentEmission.isCancelled = true;
      }

      if (!(currentEmission.isPhantom || currentEmission.isCancelled || currentEmission.isFailed)) {
        await Promise.all(this.subscribers.map((subscriber) => (subscriber instanceof Function) ? subscriber(currentEmission.value) : Promise.resolve()));
      }

      currentEmission.isComplete = true;
    } catch (error: any) {
      console.warn(`Error in stream ${this.constructor.name}: `, error);
      emission.isFailed = true;
      emission.error = error;
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

  subscribe(callback: void | ((value: any) => any)): Subscription {
    this.subscribers.push(callback);

    if (this.subscribers.length === 1 && this.isRunning.value === false) {
      queueMicrotask(async () => {
        try {
          this.isRunning.resolve(true);

          // Emit start value if defined
          await this.onStart.process(this);

          // Run the actual stream logic
          await this.run();

          // Emit end value if defined
          await this.onComplete.process(this);
        } catch (error) {
          // Handle error if catchError defined
          await this.onError.process(this, { error });
          if (this.onError instanceof NoopHook) {
            this.isFailed.resolve(error);
          }
        } finally {
          // Handle finalize callback
          await this.onStop.process(this);

          this.isStopped.resolve(true);
          this.isRunning.reset();
        }
      });
    }

    return { unsubscribe: () => callback instanceof Function ? this.unsubscribe(callback) : Function.prototype };
  }
}

export class StreamSink extends AbstractStream {
  protected source: AbstractStream;
  protected next?: StreamSink;

  protected head?: AbstractOperator;
  protected tail?: AbstractOperator;

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

  pipe(...operators: (AbstractOperator | AbstractHook)[]): StreamSink {

    for (const operator of operators) {
      if (operator instanceof AbstractOperator) {
        if (!this.head) {
          this.head = operator;
          this.tail = operator;
        } else {
          this.tail!.next = operator;
          this.tail = operator;
        }
      }
      else {
        if (operator instanceof StartWithHook) {
          this.onStart = operator;
        } else if (operator instanceof EndWithHook) {
          this.onComplete = operator;
        } else if (operator instanceof CatchErrorHook) {
          this.onError = operator;
        } else if (operator instanceof FinalizeHook) {
          this.onStop = operator;
        } else {
          throw new Error("Unknown hook");
        }
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
        await Promise.all(this.subscribers.map((subscriber) => (subscriber instanceof Function) ? subscriber(currentEmission.value) : Promise.resolve()));
      }

      currentEmission.isComplete = true;
    } catch (error: any) {
      console.warn(`Error in stream ${this.constructor.name}: `, error);
      emission.isFailed = true;
      emission.error = error;
    }
  }

  split(operator: AbstractOperator, stream: AbstractStream) {
    let subscribers = this.subscribers.slice();
    const callback = () => {};
    this.subscribers = [callback];

    this.tail = operator;

    this.next = stream instanceof StreamSink ? stream : new StreamSink(stream);
    this.next.head = operator.next; this.next.tail = this.tail;

    subscribers.forEach(subscriber => this.next!.subscribe(subscriber));

    this.next.unsubscribe = new Proxy(this.unsubscribe, {
      apply: (targetUnsubscribe, thisArg, argumentsList: any) => {
        targetUnsubscribe.apply(thisArg, argumentsList);
        if (this.subscribers.length === 0) {
          this.unsubscribe(callback)
        }
      }
    });

    return this.next;
  }
}
