import { createSubject } from "../streams/subject";
import { createEmission, Emission } from "./emission";
import { Operator, StreamOperator } from "./operator";
import { createReceiver, Receiver } from "./receiver";
import { createSubscription, Subscription } from "./subscription";

export type Stream<T = any> = {
  type: "stream" | "subject";
  name?: string;
  emissionCounter: number;

  /**
   * Subscribe to the stream to receive emissions.
   * Returns a Subscription that can be used to unsubscribe.
   */
  subscribe: (callback?: ((value: T) => void) | Receiver<T>) => Subscription;

  /**
   * Pipes transformations or stream operators into a new stream.
   * Each operator can modify emissions before they reach the subscriber.
   */
  pipe: (...steps: (Operator | StreamOperator)[]) => Stream<T>;

  /**
   * Retrieves the last emitted value, if any.
   */
  value: () => T | undefined;

  completed: () => boolean;
};

export function createStream<T = any>(
  name: string,
  generatorFn: (this: Stream<T>) => AsyncGenerator<Emission<T>, void, unknown>
): Stream<T> {
  let emissionCounter = 0;
  let running = false;
  let completed = false;
  let currentValue: T | undefined;

  // Define the async generator function
  async function* generator() {
    for await (const emission of generatorFn.call(stream)) {
      emissionCounter++;
      currentValue = emission.value;
      yield emission;
    }
  }

  const chain = function (this: Stream, ...operators: Operator[]): Stream {
    const output = createSubject();
    let isCompleteCalled = false;

    const subscription = this.subscribe({
      next: (value: any) => {
        let emission = createEmission({ value });

        // Apply operators sequentially
        for (const operator of operators) {
          try {
            emission = operator.handle(emission, this);
          } catch (error) {
            emission.error = error;
          }

          // Stop processing if an error occurred
          if (emission.error) {
            break;
          }
        }

        // If no error, push emission value to the output stream
        if (!emission.error) {
          output.next(emission.value);
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

    return output; // Return the transformed stream
  };

  const pipe = function(this: Stream, ...steps: (Operator | StreamOperator)[]): Stream {
    let combinedStream: Stream = this;
    let operatorsGroup: Operator[] = []; // Group to accumulate SimpleOperators

    // Process each step in the pipeline
    for (const step of steps) {
      if ('handle' in step) {
        // If it's a StreamOperator (with a handle method), add it to the operators group
        operatorsGroup.push(step);
      } else if (typeof step === 'function') {
        // If it's a regular Operator, handle SimpleOperators first
        if (operatorsGroup.length > 0) {
          // Chain the current accumulated group of SimpleOperators
          combinedStream = chain.call(combinedStream, ...operatorsGroup);
          operatorsGroup = []; // Reset the group
        }

        // Apply the regular operator to the stream
        combinedStream = step(combinedStream);
      } else {
        throw new Error("Invalid step provided to pipe.");
      }
    }

    // Apply remaining SimpleOperators after all steps are processed, if any
    if (operatorsGroup.length > 0) {
      combinedStream = chain.call(combinedStream, ...operatorsGroup);
    }

    return combinedStream; // Return the transformed stream
  };

  const subscribe = (
    callbackOrReceiver?: ((value: T) => void) | Receiver<T>
  ): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    const iter = generator();

    running = true;

    const unsubscribe = async () => {
      if (running && !completed) {
        completed = true;
      }
    };

    (async () => {
      try {
        for await (const emission of iter) {
          receiver.next?.(emission.value!);
        }
        receiver.complete?.();
      } catch (err: any) {
        receiver.error?.(err);
      } finally {
        completed = true;
      }
    })();

    return createSubscription(() => currentValue, unsubscribe);
  };

  const stream: Stream<T> = {
    type: "stream",
    name,
    emissionCounter,
    subscribe,
    pipe,
    value: () => currentValue,
    completed: () => completed
  };

  return stream;
}
