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
    const boundCallback = callback === undefined
      ? () => Promise.resolve()
      : (value: T) => Promise.resolve(callback!(value));

    this.subscribers.chain(this, boundCallback);

    if (!this.onEmission.contains(this, this.emit)) {
      this.onEmission.chain(this, this.emit);
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
              this.onEmission.clear();
              this.complete();
          }
      }
    };
  }

  pipe(...operators: Operator[]): Subscribable<T> {
    return new Pipeline(this).pipe(...operators);
  }

  async emit({ emission, source }: { emission: Emission; source: any }): Promise<void> {
    try {
      let next = (source instanceof Operator) ? source.next : undefined;

      if (this.isCancelled()) {
        emission.isCancelled = true;
      }

      emission = await (next?.process(emission, this) ?? Promise.resolve(emission));

      if (!(emission.isPhantom || emission.isCancelled || emission.isFailed)) {
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
}
