import { Emission, Operator, Pipeline, Subscribable, Subscription } from '../abstractions';
import { hook, promisified, PromisifiedType } from '../utils';

export abstract class Stream<T = any> implements Subscribable {

  #completionPromise = promisified<void>();
  #isAutoComplete = false;
  #isStopRequested = false;

  #isStopped = false;
  #isRunning = false;

  #onStart = hook();
  #onComplete = hook();
  #onStop = hook();
  #onError = hook();
  #onEmission = hook();

  #currentValue: T | undefined;

  abstract run(): Promise<void>;

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
      this.isStopRequested = true;
      return new Promise<void>((resolve) => {
        this.onStop.once(() => resolve());
        this.#completionPromise.promise();
      });
    }
    return Promise.resolve();
  }

  queueMicrotask(): void {
    queueMicrotask(async () => {
      try {
        // Emit start value if defined
        await this.onStart.parallel();

        // Start the actual stream logic
        if (!this.isRunning) { this.isRunning = true; await this.run(); }
        else { await this.#completionPromise; }

        // Emit end value if defined
        await this.onComplete.parallel();
      } catch (error) {
          await this.onError.parallel({ error });
      } finally {
        this.isStopped = true; this.isRunning = false;
        // Handle finalize callback
        await this.onStop.parallel();
      }
    });
  }

  subscribe(callback?: ((value: T) => void) | void): Subscription {
    const boundCallback = ({ emission, source }: any) => {
      this.#currentValue = emission.value;
      return callback === undefined ? Promise.resolve() : Promise.resolve(callback(emission.value));
    };

    this.#onEmission.chain(this, boundCallback);

    this.queueMicrotask();

    const value: any = () => this.#currentValue;
    value.unsubscribe = async () => {
      await this.complete();
      this.#onEmission.remove(this, boundCallback);
    };

    return value;
  }

  pipe(...operators: Operator[]): Subscribable<T> {
    return new Pipeline(this).pipe(...operators);
  }

  async emit({ emission, source }: { emission: Emission; source: any }): Promise<void> {
    try {
        if (emission.isFailed) {
            throw emission.error;
        }

        if (!emission.isPhantom) {
            await this.#onEmission.parallel({ emission, source });
        }

        emission.isComplete = true;
    } catch (error) {
        emission.isFailed = true;
        emission.error = error;

        await this.onError.parallel({ error });
    }
  }

  get value(): T | undefined {
    return this.#currentValue;
  }
}
