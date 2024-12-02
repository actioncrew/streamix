import { createReceiver, Receiver, Stream } from '../abstractions';
import { createSubject } from '../streams';
import { hook } from '../utils';
import { Operator } from '../abstractions';
import { flags, hooks, internals, Subscribable, SubscribableInternals } from './subscribable';
import { Subscription } from './subscription';
import { createEmission } from '../abstractions';

// This represents the internal structure of a pipeline
export type Pipeline<T> = Subscribable<T> & {
  name: string;
  chunks: Stream<T>[];
  operators: Operator[];

  [internals]: SubscribableInternals & {
    bindOperators: (...operators: Operator[]) => Pipeline<T>;
  };
};

export function createPipeline<T = any>(subscribable: Subscribable<T>): Pipeline<T> {
  let chunks: Stream<T>[] = [];
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

  if (subscribable.type === 'stream' || subscribable.type === 'subject') {
    const chunk = subscribable as unknown as Stream<T>;
    chunks = [chunk];
    operators = [...chunk.operators];
  } else if (subscribable.type === 'pipeline') {
    const pipe = subscribable as unknown as Pipeline<T>;
    chunks = [...pipe.chunks];
    operators = [...pipe.operators];
  }

  const getFirstChunk = () => chunks[0];
  const getLastChunk = () => chunks[chunks.length - 1];

  const bindOperators = function (...ops: Operator[]): Pipeline<T> {

    chunks.forEach((c) => c[hooks].onError.remove(pipeline, onErrorCallback));
    getFirstChunk()[hooks].onStart.remove(pipeline, onStartCallback);
    getLastChunk()[hooks].subscribers.remove(pipeline, onEmissionCallback);
    getLastChunk()[hooks].onComplete.remove(pipeline, onCompleteCallback);
    getLastChunk()[hooks].onStop.remove(pipeline, onStopCallback);

    let chunk: Stream<T>;

    if (subscribable.type === 'pipeline' && ops.length > 0) {
      const lastChunk = getLastChunk();
      const operator = lastChunk.operators[lastChunk.operators.length - 1];
      if (operator && 'stream' in operator) {
        chunk = (lastChunk.operators[lastChunk.operators.length - 1] as any).stream;
      } else {
        // If there are existing chunks, use a Subject to replicate the last chunk's result
        const sourceSubject = createSubject<T>();

        // Subscribe to the last chunk's result and replicate emissions to the new Subject
        const subscription = lastChunk.subscribe((value) => {
          sourceSubject.next(value);
        });

        lastChunk[hooks].onStop.once(() => {
          sourceSubject[flags].isAutoComplete = true;
          subscription.unsubscribe();
        });
        // Create a new chunk using the source subject
        chunk = sourceSubject;
      }
      chunks.push(chunk);
    } else {
      chunk = getLastChunk();
    }

    let chunkOperators: Operator[] = [];

    // Process each operator
    ops.forEach((operator) => {
      const clonedOperator = operator.clone();
      clonedOperator.init(chunk);
      chunkOperators.push(clonedOperator);
      operators.push(clonedOperator);

      // If operator has a stream, finalize current chunk and start a new one
      if ('stream' in clonedOperator) {
        chunk[internals].bindOperators(...chunkOperators);
        chunkOperators = [];
        chunk = clonedOperator.stream as any;
        chunks.push(chunk);  // Push new chunk to `this.chunks`
      }
    });

    // Finalize the last chunk with remaining operators
    chunk[internals].bindOperators(...chunkOperators);

    // Re-bind hooks across chunks
    chunks.forEach((c) => c[hooks].onError.chain(pipeline, onErrorCallback));
    getFirstChunk()[hooks].onStart.chain(pipeline, onStartCallback);
    getLastChunk()[hooks].subscribers.chain(pipeline, onEmissionCallback);
    getLastChunk()[hooks].onComplete.chain(pipeline, onCompleteCallback);
    getLastChunk()[hooks].onStop.chain(pipeline, onStopCallback);

    return pipeline;  // Return `this` to allow chaining
  };

  const pipe = function(...ops: Operator[]): Pipeline<T> {
    return createPipeline<T>(pipeline)[internals].bindOperators(...ops);
  };

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    // If the first chunk has a defined value, emit it after pipeline starts
    const firstChunk = getFirstChunk();
    if (firstChunk.value !== undefined) {
      pipeline[internals].awaitStart().then(() => {
        firstChunk[hooks].onEmission.parallel({
          emission: createEmission({ value: firstChunk.value }),
          source: firstChunk,
        });
      });
    }

    // Define the subscription object
    const subscription = getLastChunk().subscribe(callbackOrReceiver);

    // Loop through chunks in reverse order (starting from the last one)
    for (let i = chunks.length - 2; i >= 0; i--) {
      const chunk = chunks[i];
      if(!chunk.isRunning) {
        chunk.isRunning = true;
        queueMicrotask(chunk.run);
      }
    }

    return subscription;
  };

  const complete = async (): Promise<void> => {
    // Create an array of promises, one for each chunk
    const chunkPromises = chunks.map((chunk) => {
      // Check if the chunk is already stopped
      if (chunk[flags].isStopped) {
        return Promise.resolve(); // Immediately resolve if already stopped
      }

      // Otherwise, create a promise that resolves when `onStop` fires
      return new Promise<void>((resolve) => {
        chunk[hooks].onStop.once(resolve);
      });
    });

    // Mark the first chunk as requested to stop
    await chunks[0].complete();

    // Wait for all chunks to finish processing
    await Promise.all(chunkPromises);
  };


  const pipeline: Pipeline<T> = {
    type: "pipeline" as "pipeline",
    name: getFirstChunk().name!,
    chunks,
    operators,
    emissionCounter: getLastChunk().emissionCounter,
    pipe,
    complete,
    subscribe,
    get value() {
      return currentValue;
    },

    [internals]: {
      bindOperators,
      awaitStart: () => getFirstChunk()[internals].awaitStart(),
      shouldComplete: () => getFirstChunk()[internals].shouldComplete(),
      awaitCompletion: () => getFirstChunk()[internals].awaitCompletion(),
    },

    [flags]: {
      get isAutoComplete() {
        return getFirstChunk()[flags].isAutoComplete;
      },
      set isAutoComplete(value: boolean) {
        getFirstChunk()[flags].isAutoComplete = value;
      },
      get isStopRequested() {
        return getFirstChunk()[flags].isStopRequested;
      },
      set isStopRequested(value: boolean) {
        getFirstChunk()[flags].isStopRequested = value;
      },
      get isStopped() {
        return getLastChunk()[flags].isStopped;
      },
      set isStopped(value: boolean) {
        getLastChunk()[flags].isStopped = value;
      },
      get isRunning() {
        return getLastChunk()[flags].isRunning;
      },
      set isRunning(value: boolean) {
        getLastChunk()[flags].isRunning = value;
      }
    },

    [hooks]: {
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
    }
  };

  chunks.forEach((c) => c[hooks].onError.chain(pipeline, onErrorCallback));
  getFirstChunk()[hooks].onStart.chain(pipeline, onStartCallback);
  getLastChunk()[hooks].subscribers.chain(pipeline, onEmissionCallback);
  getLastChunk()[hooks].onComplete.chain(pipeline, onCompleteCallback);
  getLastChunk()[hooks].onStop.chain(pipeline, onStopCallback);

  return pipeline;
};

export function multicast<T = any>(source: Subscribable<T>, bufferSize: number = Infinity): Subscribable<T> {
  const subject = createSubject<T>();
  const cache: T[] = [];
  const subscription = source.subscribe((value) => {
      // Cache each new emission, respecting the buffer size
      cache.push(value);
      if (!isNaN(bufferSize) && cache.length > bufferSize) {
          cache.shift(); // Keep the cache within the buffer limit
      }
      subject.next(value); // Emit to active subscribers
  });

  source[hooks].onStop.once(() => subject[flags].isStopRequested = true);

  const pipeline = createPipeline<T>(subject);
  let subscribers = 0;

  const originalSubscribe = pipeline.subscribe.bind(pipeline);

  pipeline.subscribe = (observer: (value: T) => void): Subscription => {
      // Replay cached values to the new subscriber
      const replayCache = async () => {
          for (const value of cache) {
              await observer(value);
          }
      };

      replayCache(); // Trigger replay of cached values

      const originalSubscription = originalSubscribe(observer);
      subscribers++;

      const subscription: Subscription = () => cache.length ? cache[cache.length - 1] : undefined;
      subscription.unsubscribed = false

      subscription.unsubscribe = async () => {
        if(!subscription.unsubscribed) {
          originalSubscription.unsubscribe();
          subscribers--;
          if (subscribers === 0) {
            subscription.unsubscribe();
          }
          subscription.unsubscribed = true;
        }

      };

      return subscription;
  };

  return pipeline;
};

