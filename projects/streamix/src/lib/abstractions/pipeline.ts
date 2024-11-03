import { Chunk, createChunk, Stream } from '../abstractions';
import { createSubject, Subject } from '../';
import { hook, HookType } from '../utils';
import { Operator } from '../abstractions';
import { Subscribable } from './subscribable';
import { Subscription } from './subscription';

// This represents the internal structure of a pipeline
export type Pipeline<T> = Subscribable<T> & {
  stream: Stream<T>;
  chunks: Chunk<T>[];
  operators: Operator[];
  bindOperators: (...operators: Operator[]) => Pipeline<T>;
};

export function createPipeline<T = any>(stream: Subscribable<T>): Pipeline<T> {
  let chunks: Chunk<T>[] = [];
  let operators: Operator[] = [];
  let currentValue: T | undefined;

  const onStart = hook();
  const onComplete = hook();
  const onStop = hook();
  const onError = hook();
  const onEmission = hook();

  const onStartCallback = (params: any) => onStart.parallel(params);
  const onEmissionCallback = (params: any) => onEmission.parallel(params);
  const onCompleteCallback = (params: any) => onComplete.parallel(params);
  const onStopCallback = (params: any) => onStop.parallel(params);
  const onErrorCallback = (params: any) => onError.parallel(params);

  if (stream.type === 'chunk') {
    const chunk = stream as unknown as Chunk<T>;
    chunks = [chunk];
    operators = [...chunk.operators];
  } else if (stream.type === 'pipeline') {
    const pipe = stream as unknown as Pipeline<T>;
    chunks = [...pipe.chunks];
    operators = [...pipe.operators];
  }

  const getFirstChunk = () => chunks[0];
  const getLastChunk = () => chunks[chunks.length - 1];

  const bindOperators = function (this: Pipeline<T>, ...ops: Operator[]): Pipeline<T> {
    const getFirstChunk = () => this.chunks[0];
    const getLastChunk = () => this.chunks[this.chunks.length - 1];

    let chunk: Chunk<T>;

    if (stream.type === 'stream') {
      chunk = createChunk(stream as unknown as Stream<T>);
    } else {
      const lastChunk = getLastChunk();
      const operator = lastChunk.operators[lastChunk.operators.length - 1];
      if (operator && 'stream' in operator) {
        chunk = createChunk((lastChunk.operators[lastChunk.operators.length - 1] as any).stream);
      } else {
        // If there are existing chunks, use a Subject to replicate the last chunk's result
        const sourceSubject = createSubject<T>();

        // Subscribe to the last chunk's result and replicate emissions to the new Subject
        lastChunk.subscribe((value) => {
          sourceSubject.next(value); // Emit the value to the new subject
        });

        lastChunk.onStop.chain(() => sourceSubject.complete());

        // Create a new chunk using the source subject
        chunk = createChunk(sourceSubject);
        (sourceSubject as any).chunk = chunk;
      }
    }

    this.chunks.push(chunk);

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
        chunk = createChunk(clonedOperator.stream as any);
        this.chunks.push(chunk);  // Push new chunk to `this.chunks`
      }
    });

    // Finalize the last chunk with remaining operators
    chunk.bindOperators(...chunkOperators);

    // Re-bind hooks across chunks
    this.chunks.forEach((c) => c.onError.chain(pipeline, (params: any) => this.onError.parallel(params)));
    getFirstChunk().onStart.chain(pipeline, (params: any) => this.onStart.parallel(params));
    getLastChunk().onEmission.chain(pipeline, (params: any) => this.onEmission.parallel(params));
    getLastChunk().onComplete.chain(pipeline, (params: any) => this.onComplete.parallel(params));
    getLastChunk().onStop.chain(pipeline, (params: any) => this.onStop.parallel(params));

    return this;  // Return `this` to allow chaining
  };

  const pipe = function(this: Pipeline<T>, ...ops: Operator[]): Pipeline<T> {
    return createPipeline<T>(this).bindOperators(...ops);
  };

  const subscribe = (callback?: (value: T) => void): Subscription => {
    const boundCallback = ({ emission, source }: any) => {
      currentValue = emission.value;
      return callback ? Promise.resolve(callback(emission.value)) : Promise.resolve();
    };

    onEmission.chain(pipeline, boundCallback);

    for (let i = 0; i < chunks.length; i++) {
      chunks[i].subscribe();
    }

    const value: any = () => currentValue;
    value.unsubscribe = async () => {
      await complete();
      onEmission.remove(pipeline, boundCallback);
    }
    return value as Subscription;
  };

  const complete = async (): Promise<void> => {
    for (let i = 0; i < chunks.length; i++) {
      await chunks[i].complete();
    }
  };

  const pipeline: Pipeline<T> = {
    type: "pipeline" as "pipeline",
    stream: (stream.type === 'stream' ? stream : getFirstChunk().stream) as Stream,
    chunks,
    operators,
    bindOperators,
    pipe,
    subscribe,
    get value() {
      return currentValue;
    },
    get isAutoComplete() {
      return getLastChunk().isAutoComplete;
    },
    get isStopRequested() {
      return getLastChunk().isStopRequested;
    },
    get isStopped() {
      return getLastChunk().isStopped;
    },
    get isRunning() {
      return getLastChunk().isRunning;
    },
    shouldComplete: () => getLastChunk().shouldComplete(),
    awaitCompletion: () => getLastChunk().awaitCompletion(),
    complete,

    // Getter for onStart hook
    get onStart() {
      return onStart;
    },

    // Getter for onComplete hook
    get onComplete() {
      return onComplete;
    },

    // Getter for onStop hook
    get onStop() {
      return onStop;
    },

    // Getter for onError hook
    get onError() {
      return onError;
    },

    // Getter for onEmission hook
    get onEmission() {
      return onEmission;
    }
  };

  return pipeline;
}

export function multicast<T = any>(source: Subscribable<T>): Subscribable<T> {
  const subject = createSubject<T>();
  const subscription = source.subscribe((value) => subject.next(value));
  source.onStop.once(() => subject.complete());

  const pipeline = createPipeline<T>(subject).pipe();
  const originalSubscribe = pipeline.subscribe.bind(pipeline);
  let subscribers = 0;

  pipeline.subscribe = (observer: (value: T) => void) => {
    const originalSubscription = originalSubscribe(observer);
    subscribers++;

    const value: any = () => originalSubscribe();
    value.unsubscribe = async () => {
      originalSubscription.unsubscribe();
      if (--subscribers === 0) {
        subscription.unsubscribe();
      }
    }

    return value;
  };

  return pipeline;
}

export const pipe = <T>(stream: Stream<T>, ...ops: Operator[]): Pipeline<T> => {
  return createPipeline<T>(stream).bindOperators(...ops);
};
