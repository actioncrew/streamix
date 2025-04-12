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

export function pipeStream<T = any, K = any>(
  stream: Stream<T>,
  ...steps: (Operator | StreamMapper)[]
): Stream<K> {
  // Create a subject that will be our final output
  const outputSubject = createSubject<K>();
  let isSubscribed = false;
  let pipelineSubscription: Subscription | null = null; // Store the subscription to the pipeline

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
          operatorsGroup.push(step);
        } else if ('map' in step) {
          if (operatorsGroup.length > 0) {
            combinedStream = chain(combinedStream, ...operatorsGroup);
            operatorsGroup = [];
          }
          combinedStream = step.map(combinedStream);
        } else {
          throw new Error("Invalid step provided to pipe.");
        }
      }

      if (operatorsGroup.length > 0) {
        combinedStream = chain(combinedStream, ...operatorsGroup);
      }

      // Connect the final stream to our output subject and store the subscription
      pipelineSubscription = combinedStream.subscribe({
        next: (value) => outputSubject.next(value),
        error: (err) => outputSubject.error(err),
        complete: () => outputSubject.complete()
      });
    }

    const outerSubscription = originalSubscribe.apply(this, args);

    // Return a subscription that also unsubscribes from the pipeline
    return createSubscription(() => {
      outerSubscription.unsubscribe();
      if (pipelineSubscription) {
        pipelineSubscription.unsubscribe();
        pipelineSubscription = null;
      }
    });
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
          isCompleteCalled = true;
          errorCatched = true;
          output.error(error);
          output.complete();
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
