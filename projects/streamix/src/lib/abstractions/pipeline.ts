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

  constructor(stream: Stream<T>) {
    const chunk = new Chunk(stream);
    this.chunks.push(chunk);
    this.onPipelineError = hook();
  }

  get onStart(): HookType {
    return this.firstChunk.onStart;
  }

  get onComplete(): HookType {
    return this.lastChunk.onComplete;
  }

  get onStop(): HookType {
    return this.lastChunk.onStop;
  }

  get onError(): HookType {
    return this.onPipelineError;
  }

  get onEmission(): HookType {
    return this.lastChunk.onEmission;
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
    let currentChunk = this.firstChunk;
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

    this.chunks.forEach(chunk => {
      chunk.onError.chain(this, this.errorCallback);
    });

    return this;
  }

  pipe(...operators: Operator[]): Subscribable<T> {
    this.operators = [...this.operators, ...operators];
    return this;
  }

  get isAutoComplete(): PromisifiedType<boolean> {
    return this.lastChunk.isAutoComplete;
  }

  get isStopRequested(): PromisifiedType<boolean> {
    return this.lastChunk.isStopRequested;
  }

  get isFailed(): PromisifiedType<any> {
    return this.lastChunk.isFailed;
  }

  get isStopped(): PromisifiedType<boolean> {
    return this.lastChunk.isStopped;
  }

  get isUnsubscribed(): PromisifiedType<boolean> {
    return this.lastChunk.isUnsubscribed;
  }

  get isRunning(): PromisifiedType<boolean> {
    return this.lastChunk.isRunning;
  }

  get subscribers(): HookType {
    return this.lastChunk.subscribers;
  }

  shouldComplete(): boolean {
    return this.lastChunk.shouldComplete();
  }

  awaitCompletion(): Promise<void> {
    return this.lastChunk.awaitCompletion();
  }

  async complete(): Promise<void> {
    for (let i = 0; i <= this.chunks.length - 1; i++) {
      await this.chunks[i].complete();
    }
  }

  subscribe(callback?: ((value: T) => void) | void): Subscription {
    const boundCallback = (value: T) => {
      this.currentValue = value;
      return callback === undefined ? Promise.resolve() : Promise.resolve(callback(value));
    };

    this.bindOperators(...this.operators);
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

  private get firstChunk(): Chunk<T> {
    return this.chunks[0];
  }

  private get lastChunk(): Chunk<T> {
    return this.chunks[this.chunks.length - 1];
  }

  get value(): T | undefined {
    return this.currentValue;
  }
}


export function multicast<T = any>(source: Subscribable<T>): Subscribable<T> {
  const subject = new Subject<T>();
  const subscription = source.subscribe((value) => subject.next(value));
  source.isStopped.then(() => subject.complete());

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
