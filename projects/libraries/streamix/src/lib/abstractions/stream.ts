import { eachValueFrom } from "../converters";
import { Operator } from "./operator";
import { CallbackReturnType, createReceiver, Receiver } from "./receiver";
import { createSubscription, Subscription } from "./subscription";

// Basic Stream type definition
export type Stream<T = any> = {
  type: "stream" | "subject";
  name?: string;
  subscribe: (callback?: ((value: T) => void) | Receiver<T>) => Subscription;
  pipe: (...steps: Operator[]) => Stream<any>;
};

export function pipeStream<T = any>(
  source: Stream<any>,
  ...steps: Operator<any, any>[]
): Stream<T> {
  if (!steps?.length) return source as unknown as Stream<T>;

  const sink = createStream(`sink`, async function* () {
    // Create a fresh base iterator for each subscription
    const baseIterator = eachValueFrom(source)[Symbol.asyncIterator]();

    // Apply all operators using reduce
    const finalIterator = steps.reduce<AsyncIterator<any>>(
      (iterator, operator) => operator.apply(iterator),
      baseIterator
    );

    // Yield from the composed iterator
    yield* {
      [Symbol.asyncIterator]() {
        return finalIterator;
      }
    };
  });

  return sink as unknown as Stream<T>;
}

// The stream factory function
export function createStream<T>(
  name: string,
  generatorFn: () => AsyncGenerator<T, void, unknown>
): Stream<T> {
  const subscribe = (
    callbackOrReceiver?: ((value: T) => CallbackReturnType) | Receiver<T>
  ): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    const subscription = createSubscription<T>();
    subscription.listen(generatorFn, receiver);
    return subscription;
  };

  const stream: Stream<T> = {
    type: "stream",
    name,
    subscribe,
    pipe(...steps: Operator[]) {
      return pipeStream(this, ...steps);
    }
  };

  return stream;
}

