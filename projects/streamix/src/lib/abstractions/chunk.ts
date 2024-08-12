import { Stream } from '../abstractions';
import { DefaultIfEmptyOperator, ReduceOperator } from '../hooks';
import { promisified, PromisifiedType } from '../utils';
import { Emission } from './emission';
import { Hook, hook, HookType } from './hook';
import { Operator } from './operator';
import { Subscribable } from './subscribable';
import { Subscription } from './subscription';

export class Chunk<T> implements Subscribable<T> {
  operators: Operator[] = [];

  async processEmission(params: {emission: Emission, source: any}) {
    if(params) {
      let next = (params.source instanceof Stream) ? this.head : undefined;
      next = (params.source instanceof ReduceOperator) ? params.source.next : next;
      next = (params.source instanceof DefaultIfEmptyOperator) ? params.source.next : next;
      await this.emit(params.emission, next);
    }
  }

  constructor(public stream: Stream<T>) {
    stream.onEmission.chain(this, this.processEmission);
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

  head: Operator | undefined;
  tail: Operator | undefined;

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
    this.subscribers.remove(this, callback);
    if (this.subscribers.length === 0) {
      this.isStopRequested.resolve(true);
      this.isUnsubscribed.resolve(true);
    }
  }

  // Protected method to handle the subscription chain
  subscribe(callback: ((value: T) => any) | void): Subscription {
    const boundCallback = callback ?? (() => {});
    this.subscribers.chain(this, boundCallback);

    if (this.subscribers.length === 1 && this.isRunning() === false) {
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
          this.subscribers.remove(this, boundCallback);
          if (this.subscribers.length === 0) {
              this.complete();
          }
      }
    };
  }

  pipe(...operators: Operator[]): Subscribable<T> {
    this.operators = []; this.head = undefined; this.tail = undefined;
    operators.forEach((operator, index) => {
      if (operator instanceof Operator) {
        operator = operator.clone();
        this.operators.push(operator);

        // Manage head and tail for every operator
        if (!this.head) {
          this.head = operator;
          this.tail = operator;
        } else {
          this.tail!.next = operator;
          this.tail = operator;
        }

        const hook = operator as unknown as Hook;
        if (typeof hook.init === 'function') {
          hook.init(this.stream);
        }

        if ('outerStream' in operator && index !== operators.length - 1) {
          throw new Error("Only the last operator in a chunk can contain outerStream property.");
        }
      }
    });

    return this;
  }

  clone() {
    const result = Object.create(Object.getPrototypeOf(this));
    Object.assign(result, this);
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
        await this.subscribers.parallel(currentEmission.value);
      }

      currentEmission.isComplete = true;
    } catch (error: any) {
      emission.isFailed = true;
      emission.error = error;
      this.onError.length > 0 ? this.onError.process({ error }) : (() => { this.isFailed.resolve(error); })();
    }
  }
}
