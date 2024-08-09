import { promisified } from '../utils';
import { Emission } from './emission';
import { hook } from './hook';
import { Operator } from './operator';
import { Pipeline } from './pipeline';
import { Subscribable } from './subscribable';
import { Subscription } from './subscription';

export class Stream<T = any> implements Subscribable {

  isAutoComplete = promisified<boolean>(false);
  isCancelled = promisified<boolean>(false);
  isStopRequested = promisified<boolean>(false);

  isFailed = promisified<any>(undefined);
  isStopped = promisified<boolean>(false);
  isUnsubscribed = promisified<boolean>(false);
  isRunning = promisified<boolean>(false);

  subscribers: (((value: T) => any) | void)[] = [];

  onStart = hook();
  onComplete = hook();
  onStop = hook();
  onError = hook();
  onEmission = hook();

  run(): Promise<void> {
    throw new Error('Method is not implemented.');
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
    this.subscribers = this.subscribers.filter(subscriber => subscriber !== callback);
    if (this.subscribers.length === 0) {
      this.isStopRequested.resolve(true);
      this.isUnsubscribed.resolve(true);
    }
  }

  // Protected method to handle the subscription chain
  subscribe(callback: ((value: T) => any) | void): Subscription {
    const boundCallback = callback ?? (() => {});
    this.subscribers.push(boundCallback);

    if (this.subscribers.length === 1 && this.isRunning() === false) {
      this.isRunning.resolve(true);

      queueMicrotask(async () => {
        try {
          // Emit start value if defined
          await this.onStart?.process();

          // Start the actual stream logic without waiting for it to complete
          await this.run();

          // Emit end value if defined
          await this.onComplete?.process();
        } catch (error) {
          // Handle error if catchError defined
          await this.onError?.process({ error });
          if (this.onError === undefined) {
            this.isFailed.resolve(error);
          }
        } finally {
          // Handle finalize callback
          await this.onStop?.process();

          this.isStopped.resolve(true);
          this.isRunning.reset();
        }
      });
    }

    return {
      unsubscribe: () => {
          this.subscribers = this.subscribers.filter(cb => cb !== boundCallback);
          if (this.subscribers.length === 0) {
              this.complete();
          }
      }
    };
  }

  head: Operator | undefined = undefined;
  tail: Operator | undefined = undefined;

  pipe(...operators: Operator[]): Subscribable<T> {
    return new Pipeline(this, ...operators);
  }

  clone() {
    const result = Object.create(Object.getPrototypeOf(this));
    Object.assign(result, this);

    result.subscribers = this.subscribers.slice();

    result.onStart = hook();
    result.onComplete = hook();
    result.onStop = hook();
    result.onError = hook();

    // Clone the current operator chain to the new sink
    if (this.head) {
      const [head, tail] = this.cloneOperatorChain(this.head, this.tail);
      result.head = head; result.tail = tail;
    }

    return result;
  }

  cloneOperatorChain(head: Operator, tail?: Operator): [Operator, Operator] {
    const clonedHead = head.clone();
    let original = head.next;
    let cloned = clonedHead;

    while (original) {
      const clonedOperator = original.clone();
      cloned.next = clonedOperator;
      cloned = clonedOperator;
      if (original === tail) {
        break;
      }
      original = original.next;
    }

    return [clonedHead, cloned];
  }

  async emit(emission: Emission, next: Operator): Promise<void> {
    try {
      let currentEmission: Emission = emission;

      if (this.isCancelled()) {
        currentEmission.isCancelled = true;
      }

      currentEmission = await (next?.process(currentEmission, this) ?? Promise.resolve(currentEmission));

      if (!(currentEmission.isPhantom || currentEmission.isCancelled || currentEmission.isFailed)) {
        await Promise.all((() => this.subscribers.map((subscriber) => (subscriber instanceof Function) ? subscriber(currentEmission.value) : Promise.resolve()))());
      }

      currentEmission.isComplete = true;
    } catch (error: any) {
      console.warn(`Error in stream ${this.constructor.name}: `, error);
      emission.isFailed = true;
      emission.error = error;
    }
  }
}
