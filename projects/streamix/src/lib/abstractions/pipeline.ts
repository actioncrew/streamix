import { Chunk, Emission, Stream } from '../abstractions';
import { hook, HookType, PromisifiedType } from '../utils';
import { Operator } from './operator';
import { Subscribable } from './subscribable';
import { Subscription } from './subscription';

export class Pipeline<T = any> implements Subscribable<T> {
  private chunks: Chunk<T>[] = [];
  private operators: Operator[] = [];
  private onPipelineError: HookType;

  constructor(stream: Stream<T>) {
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

  start(context: any) {
    for (let i = context.chunks.length - 1; i >= 0; i--) {
      context.chunks[i].stream.start(context.chunks[i]);
    }
  }

  run(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  emit({ emission, source }: { emission: Emission; source: any; }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async errorCallback(error: any) {
    await this.onPipelineError.process(error);
  }

  private applyOperators(...operators: Operator[]): void {
    this.operators = operators;
    let currentChunk = this.first;
    let chunkOperators: Operator[] = [];

    operators.forEach(operator => {
      if (operator instanceof Operator) {
        operator = operator.clone();
        chunkOperators.push(operator);

        if ('outerStream' in operator) {
          currentChunk.pipe(...chunkOperators);
          chunkOperators = [];
          currentChunk = new Chunk(operator.outerStream as any);
          this.chunks.push(currentChunk);
        }
      }
    });

    currentChunk.pipe(...chunkOperators);

    this.chunks.forEach(chunk => {
      chunk.onError.chain(this, this.errorCallback);
    });
  }

  pipe(...operators: Operator[]): Subscribable<T> {
    // Create a new Pipeline instance with the existing streams and new operators
    const newPipeline = new Pipeline<T>(this.first);
    newPipeline.applyOperators(...this.operators, ...operators)
    return newPipeline;
  }

  get isAutoComplete(): PromisifiedType<boolean> {
    return this.last.isAutoComplete;
  }

  get isCancelled(): PromisifiedType<boolean> {
    return this.last.isCancelled;
  }

  get isStopRequested(): PromisifiedType<boolean> {
    return this.last.isStopRequested;
  }

  get isFailed(): PromisifiedType<any> {
    return this.last.isFailed;
  }

  get isStopped(): PromisifiedType<boolean> {
    return this.last.isStopped;
  }

  get isUnsubscribed(): PromisifiedType<boolean> {
    return this.last.isUnsubscribed;
  }

  get isRunning(): PromisifiedType<boolean> {
    return this.last.isRunning;
  }

  get subscribers(): HookType {
    return this.last.subscribers;
  }

  shouldTerminate(): boolean {
    return this.last.shouldTerminate();
  }

  awaitTermination(): Promise<void> {
    return this.last.awaitTermination();
  }

  async terminate(): Promise<void> {
    for (let i = 0; i <= this.chunks.length - 1; i++) {
      await this.chunks[i].terminate();
    }
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

  subscribe(callback?: (value: T) => any): Subscription {
    const boundCallback = callback === undefined
      ? () => Promise.resolve()
      : (value: T) => Promise.resolve(callback!(value));

    this.subscribers.chain(this, boundCallback);

    this.start(this);

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

  private get first(): Chunk<T> {
    return this.chunks[0];
  }

  private get last(): Chunk<T> {
    return this.chunks[this.chunks.length - 1];
  }
}
