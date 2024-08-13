import { Hook, Stream } from '../abstractions';
import { hook, HookType, promisified, PromisifiedType } from '../utils';
import { Emission } from './emission';
import { Operator } from './operator';
import { Subscribable } from './subscribable';
import { Subscription } from './subscription';

export class Chunk<T = any> implements Subscribable<T> {
  operators: Operator[] = [];

  constructor(public stream: Stream<T>) {
    stream.onEmission.chain(this, this.emit);
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

  // Protected method to handle the subscription chain
  subscribe(callback: ((value: T) => any) | void): Subscription {
    const boundCallback = callback ?? (() => {});
    this.subscribers.chain(this, boundCallback);

    if (this.subscribers.length === 1 && this.isRunning() === false) {
      this.isRunning.resolve(true);
      const stream = this.stream;
      queueMicrotask(async () => {
        try {
          // Emit start value if defined
          await stream.onStart.process();

          // Start the actual stream logic
          await this.run();

          // Emit end value if defined
          await stream.onComplete.process();
        } catch (error) {
          this.isFailed.resolve(error);
        } finally {
          // Handle finalize callback
          await stream.onStop.process();

          this.isStopped.resolve(true);
          this.isRunning.reset();
        }
      });
    }

    return {
      unsubscribe: () => {
          this.subscribers.remove(this, boundCallback);
          if (this.subscribers.length === 0) {
              this.isUnsubscribed.resolve(true);
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

  async emit({ emission, source }: { emission: Emission; source: any }): Promise<void> {
    try {
      let next = (source instanceof Stream) ? this.head : undefined;
      next = (source instanceof Operator) ? source.next : next;

      if (this.isCancelled()) {
        emission.isCancelled = true;
      }

      // Process the emission with the next operator, if any
      emission = await (next?.process(emission, this) ?? Promise.resolve(emission));

      // If emission is valid, notify subscribers
      if (!(emission.isPhantom || emission.isCancelled || emission.isFailed)) {
        await this.subscribers.parallel(emission.value);
      }

      emission.isComplete = true;
    } catch (error: any) {
      // Handle the error case
      emission.isFailed = true;
      emission.error = error;

      const stream = this.stream;
      if (stream.onError.length > 0) {
        await stream.onError.process({ error });
      } else {
        this.isFailed.resolve(error);
      }
    }
  }
}
