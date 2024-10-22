import { Chunk, Stream } from '../abstractions';
import { Subject } from '../';
import { hook, HookType, PromisifiedType } from '../utils';
import { Operator } from './operator';
import { Subscribable } from './subscribable';
import { Subscription } from './subscription';

export class Pipeline<T = any> implements Subscribable<T> {
  private chunks: Chunk<T>[] = [];
  private operators: Operator[] = [];
  private onPipelineError: HookType;
  private currentValue: T | undefined;

  constructor(public stream: Stream<T>) {
    const chunk = new Chunk(stream);
    this.chunks.push(chunk);
    this.onPipelineError = hook();
  }

  get onStart(): HookType {
    return this.first.onStart;
  }

  get onComplete(): HookType {
    return this.last.onComplete;
  }

  get onStop(): HookType {
    return this.last.onStop;
  }

  get onError(): HookType {
    return this.onPipelineError;
  }

  get onEmission(): HookType {
    return this.last.onEmission;
  }

  start() {
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      this.chunks[i].stream.startWithContext(this.chunks[i]);
    }
  }

  async errorCallback(error: any) {
    await this.onPipelineError.process(error);
  }

  private bindOperators(...operators: Operator[]): Subscribable<T> {
    this.operators = operators;
    let currentChunk = this.first;
    let chunkOperators: Operator[] = [];

    operators.forEach(operator => {
      if (operator instanceof Operator) {
        operator = operator.clone();
        operator.init(currentChunk.stream);
        chunkOperators.push(operator);

        if ('stream' in operator) {
          currentChunk.bindOperators(...chunkOperators);
          chunkOperators = [];
          currentChunk = new Chunk(operator.stream as any);
          this.chunks.push(currentChunk);
        }
      }
    });

    currentChunk.bindOperators(...chunkOperators);

    this.chunks.forEach((chunk) => {
      chunk.onError.chain(this, this.errorCallback);
    });

    return this;
  }

  pipe(...operators: Operator[]): Subscribable<T> {
    return new Pipeline<T>(this.stream.clone()).bindOperators(...this.operators, ...operators)
  }

  get isAutoComplete(): PromisifiedType<boolean> {
    return this.last.isAutoComplete;
  }

  get isStopRequested(): PromisifiedType<boolean> {
    return this.last.isStopRequested;
  }

  get isStopped(): boolean {
    return this.last.isStopped;
  }

  get isRunning(): boolean {
    return this.last.isRunning;
  }

  get subscribers(): HookType {
    return this.last.subscribers;
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
      this.currentValue = value;
      return callback === undefined ? Promise.resolve() : Promise.resolve(callback(value));
    };

    this.subscribers.chain(this, boundCallback);

    this.start();

    return {
      unsubscribe: async () => {
          this.subscribers.remove(this, boundCallback);
          if (this.subscribers.length === 0) {
              this.isStopRequested.resolve(true);
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
    return this.currentValue;
  }
}


export function multicast<T = any>(source: Subscribable<T>): Subscribable<T> {
  const subject = new Subject<T>();
  const subscription = source.subscribe((value) => subject.next(value));
  source.onStop.once(() => subject.complete());

  const pipeline = new Pipeline<T>(subject);
  const originalSubscribe = pipeline.subscribe.bind(pipeline);
  let subscribers = 0;

  pipeline.subscribe = (observer: (value: T) => void) => {
    const originalSubscription = originalSubscribe(observer);
    subscribers++;
    return {
      unsubscribe: () => {
        originalSubscription.unsubscribe();
        if(--subscribers === 0) {
          subscription.unsubscribe();
        }
      }
    };
  };

  return pipeline;
}
