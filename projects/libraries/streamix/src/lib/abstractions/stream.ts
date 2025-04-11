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

export function pipeStream<T = any>(
  stream: Stream<T>,
  ...steps: (Operator | StreamMapper)[]
): Stream<T> {
  let finalStream: Stream<T> | undefined;

  // A function that chains the operators when needed
  const chainWithLazyEvaluation = () => {
    let combinedStream: Stream<T> = stream;
    let operatorsGroup: Operator[] = [];

    // Apply operators lazily (only when needed)
    for (const step of steps) {
      if ('handle' in step) {
        operatorsGroup.push(step);
      } else if ('map' in step) {
        if (operatorsGroup.length > 0) {
          combinedStream = chain(combinedStream, ...operatorsGroup);
          operatorsGroup = [];
        }
        combinedStream = step.output;
      } else {
        throw new Error("Invalid step provided to pipe.");
      }
    }

    if (operatorsGroup.length > 0) {
      combinedStream = chain(combinedStream, ...operatorsGroup);
    }

    return combinedStream as Stream<T>;
  };

  // Return a function that lazily applies operators and subscribes when needed
  const lazyStream = (subscriberArgs: any[]) => {
    if(finalStream === undefined) {
      finalStream = chainWithLazyEvaluation();
    }
    return finalStream.subscribe(...subscriberArgs);
  };

  // Return a proxy-like stream that defers the chain until subscribe
  const streamWithDeferredSubscription: Stream<T> = {
    ...stream,
    subscribe: (...args) => lazyStream(args), // Override subscribe to use lazy evaluation
  };

  return streamWithDeferredSubscription;
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
