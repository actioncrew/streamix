import { Stream } from '../abstractions';
import { DefaultIfEmptyOperator, ReduceOperator } from '../hooks';
import { promisified, PromisifiedType } from '../utils';
import { Emission } from './emission';
import { hook, HookType } from './hook';
import { Operator } from './operator';
import { Pipeline } from './pipeline';
import { Subscribable } from './subscribable';
import { Subscription } from './subscription';

export class Chunk<T> implements Subscribable<T> {

  constructor(private stream: Stream<T>) {
  }
  get isAutoComplete(): PromisifiedType<boolean> {
    return this.stream.isAutoComplete;
  }
  get isCancelled(): PromisifiedType<boolean> {
    return this.stream.isCancelled;
  }
  get isStopRequested(): PromisifiedType<boolean> {
    return this.stream.isStopRequested;
  }
  get isFailed(): PromisifiedType<any> {
    return this.stream.isFailed;
  }
  get isStopped(): PromisifiedType<boolean> {
    return this.stream.isStopped;
  }
  get isUnsubscribed(): PromisifiedType<boolean> {
    return this.stream.isUnsubscribed;
  }
  get isRunning(): PromisifiedType<boolean> {
    return this.stream.isRunning;
  }
  get subscribers(): HookType {
    return this.stream.subscribers;
  }
  get onStart(): HookType {
    return this.stream.onStart;
  }
  get onComplete(): HookType {
    return this.stream.onComplete;
  }
  get onStop(): HookType {
    return this.stream.onStop;
  }
  get onError(): HookType {
    return this.stream.onError;
  }
  get onEmission(): HookType {
    return this.stream.onEmission;
  }
  get head(): Operator {
    return this.stream.head!;
  }
  set head(value: Operator) {
    this.stream.head = value;
  }
  get tail(): Operator {
    return this.stream.tail!;
  }
  set tail(value: Operator) {
    this.stream.tail = value;
  }
  processingCallback = async (params: any) => {
    if(params) {
      let next = (params.source instanceof Chunk) ? this.head : undefined;
      next = (params.source instanceof Stream) ? this.head : next;
      next = (params.source instanceof ReduceOperator) ? params.source.next : next;
      next = (params.source instanceof DefaultIfEmptyOperator) ? params.source.next : next;
      await this.emit(params.emission, next);
    }
  };

  run(): Promise<void> {
    return this.stream.run();
  }

  shouldTerminate() {
    return this.isCancelled() || this.isFailed();
  }

  awaitTermination() {
    return promisified.race([this.isCancelled, this.isFailed]);
  }

  terminate(): Promise<void> {
    this.isCancelled.resolve(true);
    return this.isStopped.then(() => Promise.resolve());
  }

  shouldComplete() {
    return this.isAutoComplete() || this.isUnsubscribed() || this.isStopRequested();
  }

  awaitCompletion() {
    return promisified.race([this.isAutoComplete, this.isUnsubscribed, this.isStopRequested]);
  }

  complete(): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.isStopRequested.resolve(true);
        this.isStopped.then(() => resolve());
      }, 0);
    });
  }

  unsubscribe(callback: (value: T) => any): void {
    this.subscribers.remove(callback);
    if (!this.subscribers.hasCallbacks()) {
      this.isStopRequested.resolve(true);
      this.isUnsubscribed.resolve(true);
    }
  }

  // Protected method to handle the subscription chain
  subscribe(callback: ((value: T) => any) | void): Subscription {
    const boundCallback = callback ?? (() => {});
    this.subscribers.chain(boundCallback);

    if (this.subscribers.callbacks().length === 1 && this.isRunning() === false) {
      this.onEmission.chain(this.processingCallback.bind(this));
      this.isRunning.resolve(true);

      queueMicrotask(async () => {
        try {
          // Emit start value if defined
          await this.onStart.process();

          // Start the actual stream logic
          await this.run();

          // Emit end value if defined
          await this.onComplete.process();
        } catch (error) {
          this.isFailed.resolve(error);
        } finally {
          // Handle finalize callback
          await this.onStop.process();

          this.isStopped.resolve(true);
          this.isRunning.reset();
        }
      });
    }

    return {
      unsubscribe: () => {
          this.subscribers.remove(boundCallback);
          if (!this.subscribers.hasCallbacks()) {
              this.onEmission.remove(this.processingCallback);
              this.complete();
          }
      }
    };
  }

  pipe(...operators: Operator[]): Subscribable<T> {
    return new Pipeline(this.stream, ...operators);
  }

  clone() {
    const result = Object.create(Object.getPrototypeOf(this));
    Object.assign(result, this);

    result.subscribers = hook();

    result.onStart = hook();
    result.onComplete = hook();
    result.onStop = hook();
    result.onError = hook();
    result.onEmission = hook();

    return result;
  }

  async emit(emission: Emission, next: Operator | undefined): Promise<void> {
    try {
      let currentEmission: Emission = emission;

      if (this.isCancelled()) {
        currentEmission.isCancelled = true;
      }

      currentEmission = await (next?.process(currentEmission, this) ?? Promise.resolve(currentEmission));

      if (!(currentEmission.isPhantom || currentEmission.isCancelled || currentEmission.isFailed)) {
        await Promise.all((() => this.subscribers.callbacks().map((subscriber) => (subscriber instanceof Function) ? subscriber(currentEmission.value) : Promise.resolve()))());
      }

      currentEmission.isComplete = true;
    } catch (error: any) {
      emission.isFailed = true;
      emission.error = error;
      this.onError.hasCallbacks() ? this.onError.process({ error }) : (() => { this.isFailed.resolve(error); })();
    }
  }
}
