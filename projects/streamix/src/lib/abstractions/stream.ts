import { Emission, OperatorType, Pipeline, Subscribable, Subscription } from '../abstractions';
import { hook, promisified, PromisifiedType } from '../utils';

export abstract class Stream<T = any> implements Subscribable {

  _completionPromise = promisified<void>();
  _isAutoComplete = false;
  _isStopRequested = false;

  _isStopped = false;
  _isRunning = false;

  subscribers = hook();

  onStart = hook();
  onComplete = hook();
  onStop = hook();
  onError = hook();
  onEmission = hook();

  currentValue: T | undefined;

  abstract run(): Promise<void>;

  get isAutoComplete() {
    return this._isAutoComplete;
  }

  set isAutoComplete(value: boolean) {
    if(value) {
      this._completionPromise.resolve();
    }
    this._isAutoComplete = value;
  }

  get isStopRequested() {
    return this._isStopRequested;
  }

  set isStopRequested(value: boolean) {
    if(value) {
      this._completionPromise.resolve();
    }
    this._isStopRequested = value;
  }

  get isRunning() {
    return this._isRunning;
  }

  set isRunning(value: boolean) {
    this._isRunning = value;
  }

  get isStopped() {
    return this._isStopped;
  }

  set isStopped(value: boolean) {
    this._isStopped = value;
  }

  shouldComplete() {
    return this.isAutoComplete || this.isStopRequested;
  }

  awaitCompletion() {
    return this._completionPromise.promise();
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
            await this.onError.process({ error });
        } finally {
          this.isStopped = true; this.isRunning = false;
          // Handle finalize callback
          await this.onStop.process();

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
          await this.complete();
        }
      }
    };
  }

  pipe(...operators: OperatorType[]): Subscribable<T> {
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

  async propagateError(error: any): Promise<void> {
    await this.onError.process({ error });
  }

  get value(): T | undefined {
    return this.currentValue;
  }
}
