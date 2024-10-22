import { Emission, Operator, Pipeline, Subscribable, Subscription } from '../abstractions';
import { hook, promisified } from '../utils';

export abstract class Stream<T = any> implements Subscribable {

  isAutoComplete = promisified<boolean>(false);
  isStopRequested = promisified<boolean>(false);

  isFailed = promisified<any>(undefined);
  isStopped = promisified<boolean>(false);
  isUnsubscribed = promisified<boolean>(false);
  isRunning = false;

  subscribers = hook();

  onStart = hook();
  onComplete = hook();
  onStop = hook();
  onError = hook();
  onEmission = hook();

  currentValue: T | undefined;

  abstract run(): Promise<void>;

  shouldComplete() {
    return this.isAutoComplete() || this.isUnsubscribed() || this.isStopRequested();
  }

  awaitCompletion() {
    return promisified.race([this.isAutoComplete, this.isUnsubscribed, this.isStopRequested]);
  }

  complete(): Promise<void> {
    this.isStopRequested.resolve(true);
    return this.isStopped.then(() => Promise.resolve());
  }

  init() {
    if (!this.onEmission.contains(this, this.emit)) {
      this.onEmission.chain(this, this.emit);
    }
  }

  start(): void {
    return this.startWithContext(this);
  }

  startWithContext(context: any) {
    context.init();

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
          this.isFailed.resolve(error);

          if(this.onError.length > 0) {
            await this.onError.process({ error });
          }
        } finally {
          // Handle finalize callback
          await this.onStop.process();

          this.isStopped.resolve(true);
          this.isRunning = false;

          await context.cleanup();
        }
      });
    }
  }

  async cleanup() {
    this.onEmission.remove(this, this.emit);
  }

  subscribe(callback?: ((value: T) => void) | void): Subscription {
    const boundCallback = (value: T) => {
      this.currentValue = value;
      return callback === undefined ? Promise.resolve() : Promise.resolve(callback(value));
    };

    this.subscribers.chain(this, boundCallback);

    this.start();

    return {
      unsubscribe: async () => {
          this.subscribers.remove(this, boundCallback);
          if (this.subscribers.length === 0) {
              this.isUnsubscribed.resolve(true);
              await this.complete();
          }
      }
    };
  }

  pipe(...operators: Operator[]): Subscribable<T> {
    return new Pipeline(this.clone()).pipe(...operators);
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

      this.isFailed.resolve(error);
      if(this.onError.length > 0) {
        await this.onError.process({ error });
      }
    }
  }

  async propagateError(error: any): Promise<void> {
    this.isFailed.resolve(error);
    await this.onError.process({ emission: { isFailed: true, error }, source: this });
  }

  get value(): T | undefined {
    return this.currentValue;
  }

  clone() {
    // Create a new instance of the Stream class (assuming it's a class)
    const clonedStream = Object.assign(Object.create(this), this);

    // Clone each promisified property to ensure they are independent
    clonedStream.isAutoComplete = promisified(this.isAutoComplete());
    clonedStream.isStopRequested = promisified(this.isStopRequested());
    clonedStream.isFailed = promisified(this.isFailed());
    clonedStream.isStopped = promisified(this.isStopped());
    clonedStream.isUnsubscribed = promisified(this.isUnsubscribed());
    clonedStream.isRunning = this.isRunning;

    // Clone hooks by creating new hook instances (this assumes `hook()` creates a new hook object)
    clonedStream.subscribers = hook();
    clonedStream.onStart = hook();
    clonedStream.onComplete = hook();
    clonedStream.onStop = hook();
    clonedStream.onError = hook();
    clonedStream.onEmission = hook();

    // If hooks have specific subscribers or behaviors, copy them over if needed.
    // Be careful with hooks that might hold references to functions or objects you don’t want to share.

    return clonedStream;
  }
}
