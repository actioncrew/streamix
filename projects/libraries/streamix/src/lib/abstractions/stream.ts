import { createSubject } from "../streams/subject";
import { createReceiver, Receiver } from "./receiver";
import { createSubscription, Subscription } from "./subscription";

export type Operator = {
  handle: (value: any) => any;
  type: string;
  name?: string;
};

export const createOperator = (name: string, handleFn: (value: any) => any): Operator => {
  return {
    name,
    handle: handleFn,
    type: 'operator'
  };
};

export type Transformer = Omit<Operator, "handle"> & {
  (stream: Stream<any>): Stream<any>;
}

export const createTransformer = (name: string, handleFn: (stream: Stream) => Stream): Transformer => {
  const operator = handleFn as Transformer;
  Object.defineProperty(operator, 'name', { writable: true, enumerable: true, configurable: true });
  operator.name = name;
  operator.type = 'operator';
  return operator;
};

// Basic Stream type definition
export type Stream<T = any> = {
  type: "stream" | "subject";
  name?: string;
  emissionCounter: number;
  [Symbol.asyncIterator]: () => AsyncGenerator<T, void, unknown>;
  subscribe: (callback?: ((value: T) => void) | Receiver<T>) => Subscription;
  pipe: (...steps: (Operator | Transformer)[]) => Stream<any>;
  value: () => T | undefined;
  completed: () => boolean;
};

// Functional composition to extend stream functionality
export function pipeStream<T = any, K = any>(
  stream: Stream<T>,
  ...steps: (Operator | Transformer)[]
): Stream<K> {
  let combinedStream: Stream<any> = stream;
  let operatorsGroup: Operator[] = [];

  for (const step of steps) {
    if ('handle' in step) {
      // If it's an operator that has `handle`
      operatorsGroup.push(step);
    } else if (typeof step === 'function') {
      // Apply SimpleOperators or StreamOperators sequentially
      if (operatorsGroup.length > 0) {
        // Apply operators before moving to the next step
        combinedStream = chain(combinedStream, ...operatorsGroup);
        operatorsGroup = [];  // Reset operator group
      }
      // Apply the StreamOperator
      combinedStream = step(combinedStream);
    } else {
      throw new Error("Invalid step provided to pipe.");
    }
  }

  // Apply remaining operators at the end
  if (operatorsGroup.length > 0) {
    combinedStream = chain(combinedStream, ...operatorsGroup);
  }

  return combinedStream;
}

const chain = function (stream: Stream, ...operators: Operator[]): Stream {
  const output = createSubject();
  let isCompleteCalled = false; // To ensure `complete` is only processed once

  const subscription = stream.subscribe({
    next: (value: any) => {
      let errorCatched = false;
      for (let i = 0; i < operators.length; i++) {
        const operator = operators[i];

        try {
          value = operator.handle(value);
        } catch (error) {
          errorCatched = true;
          output.error(error);
        }

        if (errorCatched || value === undefined) {
          break;
        }
      }

      if (!errorCatched && value !== undefined) {
        output.next(value);
      }
    },
    complete: () => {
      if (!isCompleteCalled) {
        isCompleteCalled = true;
        output.complete();
        subscription.unsubscribe();
      }
    }
  });

  return output;
};

// The stream factory function
export function createStream<T>(
  name: string,
  generatorFn: (this: Stream<T>) => AsyncGenerator<T, void, unknown>
): Stream<T> {
  let emissionCounter = 0;
  let completed = false;
  let currentValue: T | undefined;

  async function* generator() {
    for await (const value of generatorFn.call(stream)) {
      if (value !== undefined) {
        emissionCounter++;
        currentValue = value;
        yield value;
      }
    }
  }

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    const iter = generator();

    const unsubscribe = function (this: Subscription) {
      if(!this.unsubscribed) {
        this.unsubscribed = performance.now();
        if (!completed) {
          completed = true;
        }
      }
    };

    (async () => {
      try {
        for await (const value of iter) {
          receiver.next?.(value);
        }
      } catch (err: any) {
        receiver.error?.(err);
      } finally {
        completed = true;
        receiver.complete?.();
      }
    })();

    return createSubscription(() => currentValue, unsubscribe);
  };

  const stream: Stream<T> = {
    type: "stream",
    name,
    emissionCounter,
    async *[Symbol.asyncIterator]() {
      try {
        for await (const value of generator()) {
          currentValue = value;
          yield value;
        }
      } catch (err) {
        throw err;
      } finally {
        completed = true;
      }
    },
    subscribe,
    pipe: (...steps: (Operator | Transformer)[]) => pipeStream(stream, ...steps),
    value: () => currentValue,
    completed: () => completed,
  };

  return stream;
}
