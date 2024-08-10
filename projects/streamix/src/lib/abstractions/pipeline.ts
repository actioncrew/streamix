import { Chunk, Stream } from '../abstractions';
import { PromisifiedType } from '../utils';
import { HookType } from './hook';
import { Operator } from './operator';
import { Subscribable } from './subscribable';
import { Subscription } from './subscription';

export class Pipeline<T = any> implements Subscribable<T> {
  private streams: Chunk<T>[] = [];
  private operators: Operator[] = [];

  constructor(stream: Stream<T>, ...operators: Operator[]) {
    const mainStream = stream;
    this.streams.push(new Chunk(mainStream));
    this.applyOperators(...operators);
  }

  private applyOperators(...operators: Operator[]): void {
    this.operators = operators;
    let currentStream = this.first;
    let chunkOperators: Operator[] = [];

    operators.forEach(operator => {
      if (operator instanceof Operator) {
        operator = operator.clone();
        chunkOperators.push(operator);

        if ('outerStream' in operator) {
          currentStream.pipe(...chunkOperators);
          chunkOperators = [];
          currentStream = new Chunk(operator.outerStream as any);
          this.streams.push(currentStream);
        }
      }
    });
  }

  pipe(...operators: Operator[]): Pipeline<T> {
    // Create a new Pipeline instance with the existing streams and new operators
    const newPipeline = new Pipeline<T>(this.first.stream, ...this.operators, ...operators);
    return newPipeline;
  }

  get head(): Operator {
    return this.first.head!;
  }
  set head(value: Operator) {
    this.first.head = value;
  }
  get tail(): Operator {
    return this.last.tail!;
  }
  set tail(value: Operator) {
    this.last.tail = value;
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
  get onStart(): HookType {
    return this.last.onStart;
  }
  get onComplete(): HookType {
    return this.last.onComplete;
  }
  get onStop(): HookType {
    return this.last.onStop;
  }
  get onError(): HookType {
    return this.last.onError;
  }
  get onEmission(): HookType {
    return this.last.onEmission;
  }
  shouldTerminate(): boolean {
    return this.last.shouldTerminate();
  }
  awaitTermination(): Promise<void> {
    return this.last.awaitTermination();
  }
  terminate(): Promise<void> {
    return this.last.terminate();
  }
  shouldComplete(): boolean {
    return this.last.shouldComplete();
  }
  awaitCompletion(): Promise<void> {
    return this.last.awaitCompletion();
  }
  complete(): Promise<void> {
    return this.last.complete();
  }

  subscribe(callback?: (value: T) => any): Subscription {
    const subscriptions: Subscription[] = [];
    const defaultCallback = () => {};
    callback = callback ?? defaultCallback;

    const subscribeToStream = (stream: Subscribable<T>, cb: (value: T) => any): Subscription => {
      const subscription = stream.subscribe(cb);
      subscriptions.push(subscription);
      return subscription;
    };


    for (let i = this.streams.length - 1; i >= 0; i--) {
      subscribeToStream(this.streams[i], i === this.streams.length - 1 ? callback : defaultCallback);
    }

    return {
      unsubscribe: () => {
        subscriptions.forEach(subscription => subscription.unsubscribe());
      }
    };
  }

  private get first(): Chunk<T> {
    return this.streams[0];
  }

  private get last(): Chunk<T> {
    return this.streams[this.streams.length - 1];
  }
}
