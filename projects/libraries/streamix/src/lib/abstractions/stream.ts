import { Operator, StreamMapper } from "../abstractions";
import { createSubject } from "../streams";
import { createReceiver, Receiver } from "./receiver";
import { createSubscription, Subscription } from "./subscription";

// Basic Stream type definition
export type Stream<T = any> = {
  type: "stream" | "subject";
  name?: string;
  subscribe: (callback?: ((value: T) => void) | Receiver<T>) => Subscription;
  pipe: (...steps: (Operator | StreamMapper)[]) => Stream<any>;
};

// Functional composition to extend stream functionality
export function pipeStream<T = any, K = any>(
  stream: Stream<T>,
  ...steps: (Operator | StreamMapper)[]
): Stream<K> {
  // Create a subject that will be our final output
  const outputSubject = createSubject<K>();
  let isSubscribed = false;

  // Store the original subscribe method
  const originalSubscribe = outputSubject.subscribe;

  // Override the subscribe method to trigger lazy evaluation
  outputSubject.subscribe = function(...args) {
    if (!isSubscribed) {
      isSubscribed = true;

      // Only build and connect the pipeline when someone subscribes
      let combinedStream: Stream<any> = stream;
      let operatorsGroup: Operator[] = [];

      for (const step of steps) {
        if ('handle' in step) {
          // If it's an operator that has `handle`
          operatorsGroup.push(step);
        } else if ('map' in step) {
          // Apply SimpleOperators or StreamOperators sequentially
          if (operatorsGroup.length > 0) {
            // Apply operators before moving to the next step
            combinedStream = chain(combinedStream, ...operatorsGroup);
            operatorsGroup = [];  // Reset operator group
          }
          // Apply the StreamOperator
          combinedStream = step.map(combinedStream);
        } else {
          throw new Error("Invalid step provided to pipe.");
        }
      }

      // Apply remaining operators at the end
      if (operatorsGroup.length > 0) {
        combinedStream = chain(combinedStream, ...operatorsGroup);
      }

      // Connect the final stream to our output subject
      combinedStream.subscribe({
        next: (value) => outputSubject.next(value),
        error: (err) => outputSubject.error(err),
        complete: () => outputSubject.complete()
      });
    }

    // Call the original subscribe method with the provided arguments
    return originalSubscribe.apply(this, args);
  };

  return outputSubject;
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
    error: (err: any) => {
      output.error(err);
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

  async function* generator() {
    try {
      for await (const value of generatorFn.call(stream)) {
        if (value !== undefined) {
          yield value;
        }
      }
    } catch (err: any) {
      throw err;
    }
  }

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    const subscription = createSubscription<T>();
    subscription.listen(generator, receiver);
    return subscription;
  };

  const stream: Stream<T> = {
    type: "stream",
    name,
    subscribe,
    pipe: (...steps: (Operator | StreamMapper)[]) => pipeStream(stream, ...steps),
  };

  return stream;
}
