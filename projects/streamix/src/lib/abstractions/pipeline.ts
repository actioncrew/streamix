import { createEmission, Operator, Receiver, Stream } from '../abstractions';
import { createSubject } from '../streams';
import { createEventEmitter } from '../utils';
import { eventBus } from './bus';
import { flags, internals, Subscribable, SubscribableInternals } from './subscribable';
import { Subscription } from './subscription';

// This represents the internal structure of a pipeline
export type Pipeline<T> = Subscribable<T> & {
  name: string;
  chunks: Stream<T>[];
  operators: Operator[];

  [internals]: SubscribableInternals & {
    chain: (...operators: Operator[]) => Pipeline<T>;
  };
};

export function createPipeline<T = any>(subscribable: Subscribable<T>): Pipeline<T> {
  let chunks: Stream<T>[] = [];
  let operators: Operator[] = [];
  let currentValue: T | undefined;

  const emitter = createEventEmitter();

  const onErrorCallback = (params: any) => emitter.emit('error', params);

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

  const chain = function (...ops: Operator[]): Pipeline<T> {

    chunks.forEach((c) => c.emitter.off('error', onErrorCallback));

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
          if (!sourceSubject[flags].isUnsubscribed) {
            sourceSubject.next(value);
          }
        });

        lastChunk.emitter.once('finalize', () => {
          if (!sourceSubject[internals].shouldComplete()) {
            sourceSubject[flags].isAutoComplete = true;
          }

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
        chunk[internals].chain(...chunkOperators);
        chunkOperators = [];
        chunk = clonedOperator.stream as any;
        chunks.push(chunk);  // Push new chunk to `this.chunks`
      }
    });

    // Finalize the last chunk with remaining operators
    chunk[internals].chain(...chunkOperators);

    // Re-bind hooks across chunks
    chunks.forEach((c) => c.emitter.on('error', onErrorCallback));

    return pipeline;  // Return `this` to allow chaining
  };

  const pipe = function(...ops: Operator[]): Pipeline<T> {
    return createPipeline<T>(pipeline)[internals].chain(...ops);
  };

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    // If the first chunk has a defined value, emit it after pipeline starts
    const firstChunk = getFirstChunk();
    const emissionCount = firstChunk.emissionCounter;
    if (emissionCount > 0) {
      pipeline[internals].awaitStart().then(() => {
        if(emissionCount === firstChunk.emissionCounter) {
          eventBus.enqueue({
            target: firstChunk,
            payload: {
              emission: createEmission({ value: firstChunk.value }),
              source: firstChunk,
            },
            type: 'emission'
          });
        }
      });
    }

    // Define the subscription object
    const subscription = getLastChunk().subscribe(callbackOrReceiver);
    let pipelineStarted = getLastChunk()[internals].awaitStart();

    // Loop through chunks in reverse order
    for (let i = chunks.length - 2; i >= 0; i--) {
      const chunk = chunks[i];

      if (!chunk[flags].isRunning) {
        chunk[flags].isRunning = true;

        // Chain the execution of this chunk to the previous one
        pipelineStarted = pipelineStarted
          .then(() => queueMicrotask(chunk.run))
          .then(() => chunk[internals].awaitStart());
      }
    }

    pipeline[internals].awaitStart = () => pipelineStarted;
    subscription.started = pipelineStarted;
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
        chunk.emitter.once('finalize', resolve);
      });
    });

    // Mark the first chunk as requested to stop
    await getFirstChunk().complete();

    // Wait for all chunks to finish processing
    await Promise.all(chunkPromises);
  };

  const pipeline: Pipeline<T> = {
    type: "pipeline" as "pipeline",
    name: getFirstChunk().name!,
    chunks,
    operators,
    emissionCounter: getLastChunk().emissionCounter,
    emitter,
    pipe,
    complete,
    subscribe,
    get value() {
      return currentValue;
    },

    [internals]: {
      chain,
      awaitStart: () => getFirstChunk()[internals].awaitStart(),
      shouldComplete: () => getLastChunk()[internals].shouldComplete(),
      awaitCompletion: () => getLastChunk()[internals].awaitCompletion(),
    },

    [flags]: {
      get isAutoComplete() {
        return getFirstChunk()[flags].isAutoComplete;
      },
      set isAutoComplete(value: boolean) {
        getFirstChunk()[flags].isAutoComplete = value;
      },
      get isUnsubscribed() {
        return getFirstChunk()[flags].isUnsubscribed;
      },
      set isUnsubscribed(value: boolean) {
        getFirstChunk()[flags].isUnsubscribed = value;
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
    }
  };

  chunks.forEach((c) => c.emitter.on('error', onErrorCallback));
  return pipeline;
};
