import { Chunk, Stream } from '../abstractions';
import { Subject } from '../';
import { hook, HookType, PromisifiedType } from '../utils';
import { OperatorType } from '../abstractions';
import { Subscribable } from './subscribable';
import { Subscription } from './subscription';

export class Pipeline<T = any> implements Subscribable<T> {
  private chunks: Chunk<T>[] = [];
  private operators: OperatorType[] = [];

  #currentValue: T | undefined;

  #subscribers = hook();

  #onStart = hook();
  #onComplete = hook();
  #onStop = hook();
  #onError = hook();
  #onEmission = hook();

  constructor(public stream: Stream<T>) {
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

  private bindOperators(...operators: OperatorType[]): Subscribable<T> {
    this.operators = operators;
    let currentChunk = new Chunk(this.stream);
    this.chunks.push(currentChunk);
    let chunkOperators: OperatorType[] = [];

    operators.forEach(operator => {
      operator = operator.clone();
      operator.init(currentChunk.stream);
      chunkOperators.push(operator);

      if ('stream' in operator) {
        currentChunk.bindOperators(...chunkOperators);
        chunkOperators = [];
        currentChunk = new Chunk(operator.stream as any);
        this.chunks.push(currentChunk);
      }
    });

    currentChunk.bindOperators(...chunkOperators);

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

  pipe(...operators: OperatorType[]): Subscribable<T> {
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
    if(this.chunks.length === 0) {
      this.pipe();
    }

    const boundCallback = (value: T) => {
      this.#currentValue = value;
      return callback === undefined ? Promise.resolve() : Promise.resolve(callback(value));
    };

    // Chain to pipeline subscribers
    this.subscribers.chain(this, boundCallback);

    // Start the pipeline if needed
    this.start();

    return {
      unsubscribe: async () => {
        // Remove the bound callback from the pipeline's subscribers
        this.subscribers.remove(this, boundCallback);

        // If there are no more pipeline subscribers, complete the pipeline
        if (this.subscribers.length === 0) {
          await this.complete();
        }
      }
    };
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
    return {
      unsubscribe: async () => {
        originalSubscription.unsubscribe();
        if(--subscribers === 0) {
          subscription.unsubscribe();
        }
      }
    };
  };

  return pipeline;
}
