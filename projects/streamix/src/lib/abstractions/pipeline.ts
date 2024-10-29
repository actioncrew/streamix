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

export function createPipeline<T = any>(stream: Stream<T>): Pipeline<T> {
  let chunks: Chunk<T>[] = [];
  let operators: Operator[] = [];
  let currentValue: T | undefined;

  const onStart = hook();
  const onComplete = hook();
  const onStop = hook();
  const onError = hook();
  const onEmission = hook();

  const chunk = createChunk(stream);
  chunk.onStart.chain((params: any) => onStart.parallel(params));
  chunk.onEmission.chain((params: any) => onEmission.parallel(params));
  chunk.onComplete.chain((params: any) => onComplete.parallel(params));
  chunk.onStop.chain((params: any) => onStop.parallel(params));
  chunk.onError.chain((params: any) => onError.parallel(params));
  chunks.push(chunk);

  const getFirstChunk = () => chunks[0];
  const getLastChunk = () => chunks[chunks.length - 1];

  const bindOperators = (...ops: Operator[]): Pipeline<T> => {
    operators = ops;
    let chunk = getFirstChunk();
    chunks.splice(1, chunks.length - 1);
    let chunkOperators: Operator[] = [];

    chunk.onStart.clear();
    chunk.onEmission.clear();
    chunk.onComplete.clear();
    chunk.onStop.clear();
    chunk.onError.clear();

    ops.forEach((operator) => {
      const clonedOperator = operator.clone();
      clonedOperator.init(chunk.stream);
      chunkOperators.push(clonedOperator);

      if ('stream' in clonedOperator) {
        chunk.bindOperators(...chunkOperators);
        chunkOperators = [];
        chunk = createChunk(clonedOperator.stream as any);
        chunks.push(chunk);
      }
    });

    chunk.bindOperators(...chunkOperators);
    chunks.forEach((c) => c.onError.chain((params: any) => onError.parallel(params)));
    getFirstChunk().onStart.chain((params: any) => onStart.parallel(params));
    getLastChunk().onEmission.chain((params: any) => onEmission.parallel(params));
    getLastChunk().onComplete.chain((params: any) => onComplete.parallel(params));
    getLastChunk().onStop.chain((params: any) => onStop.parallel(params));

    return pipeline;
  };

  const pipe = (...ops: Operator[]): Pipeline<T> => {
    return createPipeline<T>(stream).bindOperators(...operators, ...ops);
  };

  const subscribe = (callback?: (value: T) => void): Subscription => {
    const boundCallback = ({ emission, source }: any) => {
      currentValue = emission.value;
      return callback === undefined ? Promise.resolve() : Promise.resolve(callback(emission.value));
    };

    onEmission.chain(pipeline, boundCallback);

    // Subscribe to all chunks only if a callback is provided
    for (let i = chunks.length - 1; i >= 0; i--) {
        chunks[i].subscribe();
    }

    const value: any = () => currentValue;
    value.unsubscribe = async () => {
      await complete();
      onEmission.remove(pipeline, boundCallback);
    };

    return value as Subscription;
  };


  const complete = async (): Promise<void> => {
    for (let i = 0; i < chunks.length; i++) {
      await chunks[i].complete();
    }
  };

  const pipeline: Pipeline<T> = {
    type: "pipeline" as "pipeline",
    stream,
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
