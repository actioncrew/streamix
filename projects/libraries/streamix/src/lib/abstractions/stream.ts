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
  operators: Operator<any, any>[]
): Stream<T> {
  if (operators.length === 0) return source as unknown as Stream<T>;
  
  const baseIterator = eachValueFrom(source)[Symbol.asyncIterator]();

  // Apply all operators in sequence (pure iterator transform)
  const finalIterator = operators.reduce<AsyncIterator<any>>((iterator, operator) => {
    return operator.apply(iterator);
  }, baseIterator);

  const sink = createStream(`sink`, async function* () {
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

