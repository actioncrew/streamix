import { Emission, Operator, Pipeline, Subscribable, Subscription } from '../abstractions';
import { hook, promisified, PromisifiedType } from '../utils';

export abstract class Stream<T = any> implements Subscribable<T> {
  operators: Operator[] = [];
  head: Operator | undefined;
  tail: Operator | undefined;

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
  #subscribers = hook();

  #currentValue: T | undefined;

  constructor() {
    this.#onEmission.chain(this, this.emit);
  }

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

  get subscribers() {
    return this.#subscribers;
  }

  get isAutoComplete() {
    return this.#isAutoComplete;
  }

  set isAutoComplete(value: boolean) {
    if (value) this.#completionPromise.resolve();
    this.#isAutoComplete = value;
  }

  get isStopRequested() {
    return this.#isStopRequested;
  }

  set isStopRequested(value: boolean) {
    if (value) this.#completionPromise.resolve();
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

  get value(): T | undefined {
    return this.#currentValue;
  }

  async emit({ emission, source }: { emission: Emission; source: any }): Promise<void> {
    try {
      let next = (source instanceof Stream) ? this.head : undefined;
      next = (source instanceof Operator) ? source.next : next;

      if (emission.failed) throw emission.error;

      if (!emission.phantom) {
        emission = await (next?.process(emission, this) ?? Promise.resolve(emission));
      }

      if (emission.failed) throw emission.error;

      if (!emission.phantom) {
        await this.#subscribers.parallel({ emission, source: this });
      }

      emission.complete = true;
    } catch (error: any) {
      emission.failed = true;
      emission.error = error;
      await this.onError.parallel({ error });
    }
  }

  bindOperators(...operators: Operator[]): Subscribable<T> {
    this.operators = [];
    this.head = undefined;
    this.tail = undefined;

    operators.forEach((operator, index) => {
      this.operators.push(operator);
      if (!this.head) this.head = operator;
      else this.tail!.next = operator;
      this.tail = operator;

      if ('stream' in operator && index !== operators.length - 1) {
        throw new Error("Only the last operator in a stream can contain an outerStream property.");
      }
    });

    return this;
  }

  shouldComplete(): boolean {
    return this.isAutoComplete || this.isStopRequested;
  }

  awaitCompletion() {
    return this.#completionPromise.promise();
  }

  complete(): Promise<void> {
    if (!this.isAutoComplete) {
      this.isStopRequested = true;
      return new Promise<void>((resolve) => {
        this.onStop.once(() => { this.operators.forEach(operator => operator.cleanup()); resolve(); });
        this.#completionPromise.resolve();
      });
    }
    return Promise.resolve();
  }

  queueMicrotask(): void {
    queueMicrotask(async () => {
      try {
        await this.onStart.parallel();
        await this.run();
        await this.onComplete.parallel();
      } catch (error: any) {
        await this.onError.parallel({ error });
      } finally {
        this.isStopped = true;
        this.isRunning = false;
        await this.onStop.parallel();
      }
    });
  }

  subscribe(callback?: ((value: T) => void) | void): Subscription {
    const boundCallback = ({ emission, source }: any) => {
      this.#currentValue = emission.value;
      return callback === undefined ? Promise.resolve() : Promise.resolve(callback(emission.value));
    };

    this.#subscribers.chain(this, boundCallback);

    if (!this.isRunning && !this.isStopRequested) {
      this.isRunning = true;
      this.queueMicrotask();
    }

    const value: any = () => this.#currentValue;
    value.unsubscribe = async () => {
      await this.complete();
      this.#subscribers.remove(this, boundCallback);
    };

    return value;
  }

  pipe(...operators: Operator[]): Subscribable<T> {
    return Pipeline.pipe(this, ...operators);
  }
}
