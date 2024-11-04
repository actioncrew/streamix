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

export function createPipeline<T = any>(subscribable: Subscribable<T>): Pipeline<T> {
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

  if (subscribable.type === 'stream') {
    const chunk = createChunk(subscribable as unknown as Stream<T>);
    chunks = [chunk];
    operators = [];
  } else if (subscribable.type === 'chunk') {
    const chunk = subscribable as unknown as Chunk<T>;
    chunks = [chunk];
    operators = [...chunk.operators];
  } else if (subscribable.type === 'pipeline') {
    const pipe = subscribable as unknown as Pipeline<T>;
    chunks = [...pipe.chunks];
    operators = [...pipe.operators];
  }

  const getFirstChunk = () => chunks[0];
  const getLastChunk = () => chunks[chunks.length - 1];

  const bindOperators = function (this: Pipeline<T>, ...ops: Operator[]): Pipeline<T> {
    const getFirstChunk = () => this.chunks[0];
    const getLastChunk = () => this.chunks[this.chunks.length - 1];

    chunks.forEach((c) => c.onError.remove(pipeline, onErrorCallback));
    getFirstChunk().onStart.remove(pipeline, onStartCallback);
    getLastChunk().onEmission.remove(pipeline, onEmissionCallback);
    getLastChunk().onComplete.remove(pipeline, onCompleteCallback);
    getLastChunk().onStop.remove(pipeline, onStopCallback);

    let chunk: Chunk<T>;

    if (subscribable.type !== 'stream' && ops.length > 0) {
      const lastChunk = getLastChunk();
      const operator = lastChunk.operators[lastChunk.operators.length - 1];
      if (operator && 'stream' in operator) {
        chunk = createChunk((lastChunk.operators[lastChunk.operators.length - 1] as any).stream);
      } else {
        // If there are existing chunks, use a Subject to replicate the last chunk's result
        const sourceSubject = createSubject<T>();

        // Subscribe to the last chunk's result and replicate emissions to the new Subject
        const subscription = lastChunk.subscribe((value) => {
          sourceSubject.next(value); // Emit the value to the new subject
        });

        lastChunk.onStop.once(pipeline, () => { sourceSubject.complete(); subscription.unsubscribe(); });

        // Create a new chunk using the source subject
        chunk = createChunk(sourceSubject);
        (sourceSubject as any).chunk = chunk;
      }
      this.chunks.push(chunk);
    } else {
      chunk = getLastChunk();
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
        chunk = createChunk(clonedOperator.stream as any);
        this.chunks.push(chunk);  // Push new chunk to `this.chunks`
      }
    });

    // Finalize the last chunk with remaining operators
    chunk.bindOperators(...chunkOperators);

    // Re-bind hooks across chunks
    this.chunks.forEach((c) => c.onError.chain(pipeline, onErrorCallback));
    getFirstChunk().onStart.chain(pipeline, onStartCallback);
    getLastChunk().onEmission.chain(pipeline, onEmissionCallback);
    getLastChunk().onComplete.chain(pipeline, onCompleteCallback);
    getLastChunk().onStop.chain(pipeline, onStopCallback);

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

    for (let i = chunks.length - 1; i >= 0; i--) {
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
    stream: getFirstChunk().stream,
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

  chunks.forEach((c) => c.onError.chain(pipeline, onErrorCallback));
  getFirstChunk().onStart.chain(pipeline, onStartCallback);
  getLastChunk().onEmission.chain(pipeline, onEmissionCallback);
  getLastChunk().onComplete.chain(pipeline, onCompleteCallback);
  getLastChunk().onStop.chain(pipeline, onStopCallback);

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
