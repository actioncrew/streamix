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

  subscribers = hook();

  onStart = hook();
  onComplete = hook();
  onStop = hook();
  onError = hook();
  onEmission = hook();

  processingCallback = async (params: any) => await this.emit(params.emission, params.next);

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
  private _head!: Operator
  get head(): Operator {
    return this._head!;
  }
  set head(value: Operator) {
    this._head = value;
  }
  private _tail!: Operator
  get tail(): Operator {
    return this._tail!;
  }
  set tail(value: Operator) {
    this._tail = value;
  }

  pipe(...operators: Operator[]): Subscribable<T> {
    return new Pipeline(this, ...operators);
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
