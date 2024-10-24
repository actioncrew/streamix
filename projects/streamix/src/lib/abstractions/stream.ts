import { Emission, Operator, Pipeline, Subscribable, Subscription } from '../abstractions';
import { hook, promisified, PromisifiedType } from '../utils';

export abstract class Stream<T = any> implements Subscribable {

  #completionPromise = promisified<void>();
  #isAutoComplete = false;
  #isStopRequested = false;

  #isStopped = false;
  #isRunning = false;

  #subscribers = hook();

  #onStart = hook();
  #onComplete = hook();
  #onStop = hook();
  #onError = hook();
  #onEmission = hook();

  #currentValue: T | undefined;

  abstract run(): Promise<void>;

  get subscribers() {
    return this.#subscribers;
  }

  get onStart() {
    return this.#onStart;
  }

  get onComplete() {
    return this.#onComplete;
  }

  get onStop() {
    return this.#onStop;
  }

  get onError() {
    return this.#onError;
  }

  get onEmission() {
    return this.#onEmission;
  }

  get isAutoComplete() {
    return this.#isAutoComplete;
  }

  set isAutoComplete(value: boolean) {
    if(value) {
      this.#completionPromise.resolve();
    }
    this.#isAutoComplete = value;
  }

  get isStopRequested() {
    return this.#isStopRequested;
  }

  set isStopRequested(value: boolean) {
    if(value) {
      this.#completionPromise.resolve();
    }
    this.#isStopRequested = value;
  }

  get isRunning() {
    return this.#isRunning;
  }

  set isRunning(value: boolean) {
    this.#isRunning = value;
  }

  get isStopped() {
    return this.#isStopped;
  }

  set isStopped(value: boolean) {
    this.#isStopped = value;
  }

  shouldComplete() {
    return this.isAutoComplete || this.isStopRequested;
  }

  awaitCompletion() {
    return this.#completionPromise.promise();
  }

  complete(): Promise<void> {
    if(!this.isAutoComplete) {
      return new Promise<void>((resolve) => {
        this.onStop.once(() => resolve());
        this.isStopRequested = true;
      });
    }
    return Promise.resolve();
  }

  start(): void {
    if (!this.isRunning) {
      this.isRunning = true;
      queueMicrotask(async () => {
        try {
          // Emit start value if defined
          await this.onStart.process();

          // Start the actual stream logic
          await this.run();

          // Emit end value if defined
          await this.onComplete.process();
        } catch (error) {
            await this.onError.process({ error });
        } finally {
          this.isStopped = true; this.isRunning = false;
          // Handle finalize callback
          await this.onStop.process();
        }
      });
    }
  }

  subscribe(callback?: ((value: T) => void) | void): Subscription {
    const boundCallback = (value: T) => {
      this.#currentValue = value;
      return callback === undefined ? Promise.resolve() : Promise.resolve(callback(value));
    };

    if (!this.onEmission.contains(this, this.emit)) {
      this.onEmission.chain(this, this.emit);
    }

    this.subscribers.chain(this, boundCallback);

    this.start();

    return {
      unsubscribe: async () => {
        this.subscribers.remove(this, boundCallback);
        if (this.subscribers.length === 0) {
          this.onEmission.remove(this, this.emit);
          await this.complete();
        }
      }
    };
  }

  pipe(...operators: Operator[]): Subscribable<T> {
    return new Pipeline(this).pipe(...operators);
  }

  async emit({ emission, source }: { emission: Emission; source: any }): Promise<void> {
    try {
      if(emission.isFailed) {
        throw emission.error;
      }

      if (!emission.isPhantom) {
        await this.subscribers.parallel(emission.value);
      }

      emission.isComplete = true;
    } catch (error: any) {
      emission.isFailed = true;
      emission.error = error;

      await this.onError.process({ error });
    }
  }

  get value(): T | undefined {
    return this.#currentValue;
  }
}
