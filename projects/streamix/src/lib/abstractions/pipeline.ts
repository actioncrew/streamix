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

  #onStart = hook();
  #onComplete = hook();
  #onStop = hook();
  #onError = hook();
  #onEmission = hook();

  private onStartCallback = (params: any) => this.onStart.parallel(params);
  private onEmissionCallback = (params: any) => this.onEmission.parallel(params);
  private onCompleteCallback = (params: any) => this.onComplete.parallel(params);
  private onStopCallback = (params: any) => this.onStop.parallel(params);
  private onErrorCallback = (params: any) => this.onError.parallel(params);

  constructor(public subscribable: Subscribable<T>) {
    if (subscribable instanceof Stream) {
      const chunk = new Chunk(subscribable as unknown as Stream<T>);
      this.chunks = [chunk];
      this.operators = [];
    } else if (subscribable instanceof Chunk) {
      const chunk = subscribable as unknown as Chunk<T>;
      this.chunks = [chunk];
      this.operators = [...chunk.operators];
    } else if (subscribable instanceof Pipeline) {
      const pipe = subscribable as unknown as Pipeline<T>;
      this.chunks = [...pipe.chunks];
      this.operators = [...pipe.operators];
    }

    this.chunks.forEach((c) => c.onError.chain(this, this.onErrorCallback));
    this.firstChunk.onStart.chain(this, this.onStartCallback);
    this.lastChunk.onEmission.chain(this, this.onEmissionCallback);
    this.lastChunk.onComplete.chain(this, this.onCompleteCallback);
    this.lastChunk.onStop.chain(this, this.onStopCallback);
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

  private bindOperators(...ops: Operator[]): Pipeline<T> {

    this.chunks.forEach((c) => c.onError.remove(this, this.onErrorCallback));
    this.firstChunk.onStart.remove(this, this.onStartCallback);
    this.lastChunk.onEmission.remove(this, this.onEmissionCallback);
    this.lastChunk.onComplete.remove(this, this.onCompleteCallback);
    this.lastChunk.onStop.remove(this, this.onStopCallback);

    let chunk: Chunk<T>;

    if (!(this.subscribable instanceof Stream) && ops.length > 0) {
      const lastChunk = this.lastChunk;
      const operator = lastChunk.operators[lastChunk.operators.length - 1];
      if (operator && 'stream' in operator) {
        chunk = new Chunk((lastChunk.operators[lastChunk.operators.length - 1] as any).stream);
      } else {
        // If there are existing chunks, use a Subject to replicate the last chunk's result
        const sourceSubject = new Subject<T>();

        // Subscribe to the last chunk's result and replicate emissions to the new Subject
        const subscription = lastChunk.subscribe((value) => {
          sourceSubject.next(value); // Emit the value to the new subject
        });

        lastChunk.onStop.once(this, () => { sourceSubject.complete(); subscription.unsubscribe(); });

        // Create a new chunk using the source subject
        chunk = new Chunk(sourceSubject);
        (sourceSubject as any).chunk = chunk;
      }
      this.chunks.push(chunk);
    } else {
      chunk = this.lastChunk;
    }

    let chunkOperators: Operator[] = [];

    // Process each operator
    ops.forEach((operator) => {
      const clonedOperator = operator.clone();
      clonedOperator.init(chunk.stream);
      chunkOperators.push(clonedOperator);
      this.operators.push(clonedOperator);

      // If operator has a stream, finalize current chunk and start a new one
      if ('stream' in clonedOperator) {
        chunk.bindOperators(...chunkOperators);
        chunkOperators = [];
        chunk = new Chunk(clonedOperator.stream as any);
        this.chunks.push(chunk);  // Push new chunk to `this.chunks`
      }
    });

    // Finalize the last chunk with remaining operators
    chunk.bindOperators(...chunkOperators);

    // Re-bind hooks across chunks
    this.chunks.forEach((c) => c.onError.chain(this, this.onErrorCallback));
    this.firstChunk.onStart.chain(this, this.onStartCallback);
    this.lastChunk.onEmission.chain(this, this.onEmissionCallback);
    this.lastChunk.onComplete.chain(this, this.onCompleteCallback);
    this.lastChunk.onStop.chain(this, this.onStopCallback);

    return this;  // Return `this` to allow chaining
  };

  static pipe<T>(stream: Subscribable<T>, ...operators: Operator[]): Subscribable<T> {
    // Initialize a new Pipeline instance within the static method
    return new Pipeline<T>(stream).bindOperators(...operators);
  }

  pipe(...operators: Operator[]): Subscribable<T> {
    // Initialize a new Pipeline instance within the static method
    return Pipeline.pipe(this.subscribable, ...this.operators, ...operators);
  }

  get isAutoComplete(): boolean {
    return this.lastChunk.isAutoComplete;
  }

  get isStopRequested(): boolean {
    return this.lastChunk.isStopRequested;
  }

  get isStopped(): boolean {
    return this.lastChunk.isStopped;
  }

  get isRunning(): boolean {
    return this.lastChunk.isRunning;
  }

  shouldComplete(): boolean {
    return this.lastChunk.shouldComplete();
  }

  awaitCompletion(): Promise<void> {
    return this.lastChunk.awaitCompletion();
  }

  async complete(): Promise<void> {
    for (let i = 0; i < this.chunks.length; i++) {
      await this.chunks[i].complete();
    }
  }

  subscribe(callback?: (value: T) => void): Subscription {

    const boundCallback = ({ emission, source }: any) => {
      this.#currentValue = emission.value;
      return callback === undefined ? Promise.resolve() : Promise.resolve(callback(emission.value));
    };

    // Chain to pipeline subscribers
    this.#onEmission.chain(this, boundCallback);

    // Start the pipeline if needed
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      this.chunks[i].subscribe();
    }

    const value: any = () => this.#currentValue;
    value.unsubscribe = async () => {
      await this.complete();
      this.#onEmission.remove(this, boundCallback);
    };

    return value;
  }

  private get firstChunk(): Chunk<T> {
    return this.chunks[0];
  }

  private get lastChunk(): Chunk<T> {
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
