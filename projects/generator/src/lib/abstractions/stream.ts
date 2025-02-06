import { createSubject } from "../streams/subject";
import { createEmission, Emission } from "./emission";
import { Operator, StreamOperator } from "./operator";
import { createReceiver, Receiver } from "./receiver";
import { createSubscription, Subscription } from "./subscription";

// Basic Stream type definition
export type Stream<T = any> = {
  type: "stream" | "subject";
  name?: string;
  emissionCounter: number;
  subscribe: (callback?: ((value: T) => void) | Receiver<T>) => Subscription;
  pipe: (...steps: (Operator | StreamOperator)[]) => Stream<T>;
  value: () => T | undefined;
  completed: () => boolean;
};

// Functional composition to extend stream functionality
export function pipeStream<T>(
  stream: Stream<T>,
  ...steps: (Operator | StreamOperator)[]
): Stream<T> {
  let combinedStream: Stream<T> = stream;
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

// Function to chain operators for composition
function chain<T>(stream: Stream<T>, ...operators: Operator[]): Stream<T> {
  const output = createSubject<T>();
  let isCompleteCalled = false;

  const subscription = stream.subscribe({
    next: (value: T) => {
      let emission = createEmission({ value });
      for (const operator of operators) {
        try {
          emission = operator.handle(emission, stream);
        } catch (error) {
          emission.error = error;
        }
        if (emission.error) {
          break;
        }
      }

      if (!(emission.pending || emission.phantom || emission.error)) {
        output.next(emission.value);
      }
    },
    complete: () => {
      if (!isCompleteCalled) {
        isCompleteCalled = true;
        output.complete();
        subscription.unsubscribe();
      }
    },
  });

  return output;
}

// The stream factory function
export function createStream<T>(
  name: string,
  generatorFn: (this: Stream<T>) => AsyncGenerator<Emission<T>, void, unknown>
): Stream<T> {
  let emissionCounter = 0;
  let completed = false;
  let currentValue: T | undefined;

  async function* generator() {
    for await (const emission of generatorFn.call(stream)) {
      emissionCounter++;
      currentValue = emission.value;
      yield emission;
    }
  }

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    const iter = generator();
    const unsubscribe = () => {
      if (!completed) {
        completed = true;
      }
    };

    (async () => {
      try {
        for await (const emission of iter) {
          receiver.next?.(emission.value!);
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
    subscribe,
    pipe: (...steps: (Operator | StreamOperator)[]) => pipeStream(stream, ...steps),
    value: () => currentValue,
    completed: () => completed,
  };

  return stream;
}
