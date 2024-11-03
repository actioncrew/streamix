import { createPipeline, isStream, pipe, Stream, Subscription } from '../abstractions';
import { hook } from '../utils';
import { Emission } from './emission';
import { isOperatorType as isOperator, Operator } from '../abstractions';
import { Subscribable } from './subscribable';

export type Chunk<T = any> = Subscribable<T> & {
  stream: Stream<T>;
  operators: Operator[];
  emit: (args: { emission: Emission; source: any }) => Promise<void>;
  bindOperators(...operators: Operator[]): Chunk<T>; // Method to bind operators
};

// Function to create a Chunk
export function createChunk<T = any>(stream: Stream<T>): Chunk<T> {
  let operators: Operator[] = [];
  let head: Operator | undefined;
  let tail: Operator | undefined;
  let currentValue: T | undefined;

  const onEmission = hook();

  const initEmissionChain = () => {
    if (!stream.onEmission.contains(emit)) {
      stream.onEmission.chain(emit);
    }
  };

  const emit = async ({ emission, source }: { emission: Emission; source: any }): Promise<void> => {
    try {
      let next = isStream(source) ? head : undefined;
      next = isOperator(source) ? source.next : next;

      if (emission.isFailed) throw emission.error;

      if (!emission.isPhantom) {
        emission = await (next?.process(emission, chunk) ?? Promise.resolve(emission));
      }

      if (emission.isFailed) throw emission.error;

      if (!emission.isPhantom) {
        await onEmission.parallel({ emission, source });
      }

      emission.isComplete = true;
    } catch (error: any) {
      emission.isFailed = true;
      emission.error = error;
      await stream.onError.parallel({ error });
    }
  };

  const bindOperators = function(this: Chunk<T>, ...newOperators: Operator[]): Chunk<T> {
    this.operators = [];
    head = undefined;
    tail = undefined;

    newOperators.forEach((operator, index) => {
      this.operators.push(operator);

      if (!head) {
        head = operator;
      } else {
        tail!.next = operator;
      }
      tail = operator;

      if ('stream' in operator && index !== newOperators.length - 1) {
        throw new Error('Only the last operator in a chunk can contain an outerStream property.');
      }
    });

    return this;
  };

  const subscribe = (callback?: (value: T) => void): Subscription => {
    const boundCallback = ({ emission, source }: any) => {
      currentValue = emission.value;
      return callback ? Promise.resolve(callback(emission.value)) : Promise.resolve();
    };

    onEmission.chain(boundCallback);
    stream.subscribe();

    const value: any = () => currentValue;
    value.unsubscribe = async () => {
      await stream.complete();
      onEmission.remove(boundCallback);
    };

    return value;
  };

  const pipe = function(this: Chunk<T>, ...newOperators: Operator[]) {
    return createPipeline<T>(this).bindOperators(...newOperators);
  }

  const chunk: Chunk<T> = {
    type: "chunk" as "chunk",
    stream,
    operators,
    bindOperators,
    subscribe,
    emit,
    pipe,
    shouldComplete: () => stream.shouldComplete(),
    awaitCompletion: () => stream.awaitCompletion(),
    complete: () => stream.complete(),
    get value() {
      return currentValue;
    },
    get onStart() {
      return stream.onStart;
    },
    get onComplete() {
      return stream.onComplete;
    },
    get onStop() {
      return stream.onStop;
    },
    get onError() {
      return stream.onError;
    },
    get onEmission() {
      return onEmission;
    },
    get isAutoComplete() {
      return stream.isAutoComplete;
    },
    set isAutoComplete(value: boolean) {
      stream.isAutoComplete = value;
    },
    get isStopRequested() {
      return stream.isStopRequested;
    },
    set isStopRequested(value: boolean) {
      stream.isStopRequested = value;
    },
    get isRunning() {
      return stream.isRunning;
    },
    get isStopped() {
      return stream.isStopped;
    }
  };

  initEmissionChain(); // Initialize emission chain to capture emissions from the stream.

  return chunk;
}
