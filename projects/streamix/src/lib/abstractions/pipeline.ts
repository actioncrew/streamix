import { Chunk, Stream } from '../abstractions';
import { Subject } from '../';
import { hook, HookType, PromisifiedType } from '../utils';
import { Operator } from '../abstractions';
import { Subscribable } from './subscribable';
import { Subscription } from './subscription';

export class Pipeline<T = any> implements Subscribable<T> {
  private chunks: Chunk<T>[] = [];
  private operators: Operator[] = [];

  #currentValue: T | undefined;

  #subscribers = hook();

  #onStart = hook();
  #onComplete = hook();
  #onStop = hook();
  #onError = hook();
  #onEmission = hook();

  constructor(public stream: Stream<T>) {
    const chunk = new Chunk(stream);

    chunk.onStart.chain((params: any) => this.#onStart.parallel(params));
    chunk.onEmission.chain((params: any) => this.#onEmission.parallel(params));
    chunk.onComplete.chain((params: any) => this.#onComplete.parallel(params));
    chunk.onStop.chain((params: any) => this.#onStop.parallel(params));
    chunk.onError.chain((params: any) => this.#onError.parallel(params));

    chunk.subscribers.chain((value: any) => this.subscribers.parallel(value));
    this.chunks.push(chunk);
  }

  get subscribers(): HookType {
    return this.#subscribers;
  }

  get onStart(): HookType {
    return this.#onStart;
  }

  get onComplete(): HookType {
    return this.#onComplete;
  }

  get onStop(): HookType {
    return this.#onStop;
  }

  get onError(): HookType {
    return this.#onError;
  }

  get onEmission(): HookType {
    return this.#onEmission;
  }

  start() {
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      this.chunks[i].start();
    }
  }

  private bindOperators(...operators: Operator[]): Subscribable<T> {
    this.operators = operators;
    let chunk = this.first;
    let chunkOperators: Operator[] = [];

    chunk.onStart.clear();
    chunk.onEmission.clear();
    chunk.onComplete.clear();
    chunk.onStop.clear();
    chunk.subscribers.clear();
    chunk.onError.clear();

    operators.forEach(operator => {
      operator = operator.clone();
      operator.init(chunk.stream);
      chunkOperators.push(operator);

      if ('stream' in operator) {
        chunk.bindOperators(...chunkOperators);
        chunkOperators = [];
        chunk = new Chunk(operator.stream as any);
        this.chunks.push(chunk);
      }
    });

    chunk.bindOperators(...chunkOperators);

    // Chain error hooks to propagate errors across chunks
    this.chunks.forEach((chunk) => {
      chunk.onError.chain((params: any) => this.#onError.parallel(params));
    });

    // Chain hooks from the first and last chunks to the pipeline
    this.first.onStart.chain((params: any) => this.#onStart.parallel(params));
    this.last.onEmission.chain((params: any) => this.#onEmission.parallel(params));
    this.last.onComplete.chain((params: any) => this.#onComplete.parallel(params));
    this.last.onStop.chain((params: any) => this.#onStop.parallel(params));

    // Ensure that subscribing to the last chunk propagates values to the pipeline subscribers
    this.last.subscribers.chain((value: any) => this.subscribers.parallel(value));

    return this;
  }

  pipe(...operators: Operator[]): Subscribable<T> {
    return new Pipeline<T>(this.stream).bindOperators(...this.operators, ...operators)
  }

  get isAutoComplete(): boolean {
    return this.last.isAutoComplete;
  }

  get isStopRequested(): boolean {
    return this.last.isStopRequested;
  }

  get isStopped(): boolean {
    return this.last.isStopped;
  }

  get isRunning(): boolean {
    return this.last.isRunning;
  }

  shouldComplete(): boolean {
    return this.last.shouldComplete();
  }

  awaitCompletion(): Promise<void> {
    return this.last.awaitCompletion();
  }

  async complete(): Promise<void> {
    for (let i = 0; i <= this.chunks.length - 1; i++) {
      await this.chunks[i].complete();
    }
  }

  subscribe(callback?: (value: T) => void): Subscription {

    const boundCallback = (value: T) => {
      this.#currentValue = value;
      return callback === undefined ? Promise.resolve() : Promise.resolve(callback(value));
    };

    // Chain to pipeline subscribers
    this.subscribers.chain(this, boundCallback);

    // Start the pipeline if needed
    this.start();

    const value: any = () => this.#currentValue;
    value.unsubscribe = async () => {
      this.subscribers.remove(this, boundCallback);
      if (this.subscribers.length === 0) {
        await this.complete();
      }
    };

    return value;
  }

  private get first(): Chunk<T> {
    return this.chunks[0];
  }

  private get last(): Chunk<T> {
    return this.chunks[this.chunks.length - 1];
  }

  get value(): T | undefined {
    return this.#currentValue;
  }
}


export function multicast<T = any>(source: Subscribable<T>): Subscribable<T> {
  const subject = new Subject<T>();
  const subscription = source.subscribe((value) => subject.next(value));
  source.onStop.once(() => subject.complete());

  const pipeline = new Pipeline<T>(subject).pipe();
  const originalSubscribe = pipeline.subscribe.bind(pipeline);
  let subscribers = 0;

  pipeline.subscribe = (observer: (value: T) => void) => {
    const originalSubscription = originalSubscribe(observer);
    subscribers++;

    const value: any = () => originalSubscribe();
    value.unsubscribe = async () => {
      originalSubscription.unsubscribe();
      if(--subscribers === 0) {
        subscription.unsubscribe();
      }
    };

    return value;
  };

  return pipeline;
}
