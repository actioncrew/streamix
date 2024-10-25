import { Pipeline, Stream, Subscription } from '../abstractions';
import { hook, PromisifiedType } from '../utils';
import { Emission } from './emission';
import { Operator } from '../abstractions';
import { Subscribable } from './subscribable';

export class Chunk<T = any> extends Stream<T> implements Subscribable<T> {
  operators: Operator[] = [];
  head: Operator | undefined;
  tail: Operator | undefined;

  #onEmission = hook();
  #subscribers = hook();
  #currentValue: T | undefined;

  constructor(public stream: Stream<T>) {
    super();

    if (!this.stream.onEmission.contains(this, this.emit)) {
      this.stream.onEmission.chain(this, this.emit);
    }
  }

  override get subscribers() {
    return this.#subscribers;
  }

  override get onStart() {
    return this.stream.onStart;
  }

  override get onComplete() {
    return this.stream.onComplete;
  }

  override get onStop() {
    return this.stream.onStop;
  }

  override get onError() {
    return this.stream.onError;
  }

  override get onEmission() {
    return this.#onEmission;
  }

  override get isAutoComplete() {
    return this.stream.isAutoComplete;
  }

  override set isAutoComplete(value: boolean) {
    this.stream.isAutoComplete = value;
  }

  override get isStopRequested() {
    return this.stream.isStopRequested;
  }

  override set isStopRequested(value: boolean) {
    this.stream.isStopRequested = value;
  }

  override get isRunning() {
    return this.stream.isRunning;
  }

  override set isRunning(value: boolean) {
    this.stream.isRunning = value;
  }

  override get isStopped() {
    return this.stream.isStopped;
  }

  override set isStopped(value: boolean) {
    this.stream.isStopped = value;
  }

  override get value() {
    return this.#currentValue;
  }

  override async emit({ emission, source }: { emission: Emission; source: any }): Promise<void> {
    try {
      let next = (source instanceof Stream) ? this.head : undefined;
      next = (source instanceof Operator) ? source.next : next;

      if (emission.isFailed) {
        throw emission.error;
      }

      if (!emission.isPhantom) {
        // Process the emission with the next operator, if any
        emission = await (next?.process(emission, this) ?? Promise.resolve(emission));
      }

      if (emission.isFailed) {
        throw emission.error;
      }

      // If emission is valid, notify subscribers
      if (!emission.isPhantom) {
        await this.onEmission.parallel({ emission, source: this });
        await this.subscribers.parallel(emission.value);
      }

      emission.isComplete = true;
    } catch (error: any) {
      emission.isFailed = true;
      emission.error = error;

      await this.onError.process({ error });
    }
  }

  override start() {
    return this.stream.start();
  }

  override run(): Promise<void> {
    return this.stream.run();
  }

  override pipe(...operators: Operator[]): Subscribable<T> {
    return new Pipeline<T>(this.stream).pipe(...this.operators, ...operators);
  }

  bindOperators(...operators: Operator[]): Subscribable<T> {
    this.operators = [];
    this.head = undefined;
    this.tail = undefined;

    operators.forEach((operator, index) => {
      this.operators.push(operator);

      if (!this.head) {
        this.head = operator;
      } else {
        this.tail!.next = operator;
      }
      this.tail = operator;

      if ('stream' in operator && index !== operators.length - 1) {
        throw new Error("Only the last operator in a chunk can contain outerStream property.");
      }
    });

    return this;
  }

  override shouldComplete(): boolean {
    return this.stream.shouldComplete();
  }

  override awaitCompletion(): Promise<void> {
    return this.stream.awaitCompletion();
  }

  override async complete(): Promise<void> {
    await this.stream.complete();
  }

  override subscribe(callback?: (value: T) => void): Subscription {
    const boundCallback = (value: T) => {
      this.#currentValue = value;
      return callback === undefined ? Promise.resolve() : Promise.resolve(callback(value));
    };

    this.subscribers.chain(this, boundCallback);

    this.start();

    const value: any = () => this.#currentValue;
    value.unsubscribe = async () => {
      this.subscribers.remove(this, boundCallback);
      if (this.subscribers.length === 0) {
        await this.stream.complete();
      }
    };

    return value;
  }
}
