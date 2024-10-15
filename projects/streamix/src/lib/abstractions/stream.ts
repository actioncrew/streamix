import { Emission, Operator, Pipeline, Subscribable, Subscription } from '../abstractions';
import { hook, promisified } from '../utils';

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

  run(): Promise<void> {
    throw new Error('Method is not implemented.');
  }

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

  start(): void {
    return this.startWithContext(this);
  }

  startWithContext(context: any) {
    if (!this.onEmission.contains(context, context.emit)) {
      this.onEmission.chain(context, context.emit);
    }

    if (this.isRunning() === false) {
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

          if(this.onError.length > 0) {
            await this.onError.process({ error });
          }
        } finally {
          // Handle finalize callback
          await this.onStop.process();
          this.onEmission.remove(context, context.emit);

          this.isStopped.resolve(true);
          this.isRunning.reset();
        }
      });
    }
  }

  subscribe(callback?: ((value: T) => any) | void): Subscription {
    const boundCallback = callback === undefined
      ? () => Promise.resolve()
      : (value: T) => Promise.resolve(callback!(value));

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

      this.isFailed.resolve(error);
      if(this.onError.length > 0) {
        await this.onError.process({ error });
      }
    }
  }

  async handleError(error: any): Promise<void> {
    this.isFailed.resolve(error);
    await this.onError.process({ emission: { isFailed: true, error }, source: this });
  }
}
