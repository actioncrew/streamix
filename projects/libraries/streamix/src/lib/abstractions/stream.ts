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
  stream: Stream<T>,
  ...steps: Operator[]
): Stream<any> {
  const base: AsyncIterable<any> = eachValueFrom(stream);

  // Apply operators to get the final AsyncIterable
  const piped = steps.reduce<AsyncIterable<any>>((iter, op) => {
    return op.apply(iter);
  }, base);

  const sink = createStream(
    `pipe(${steps.map(op => op.name ?? 'anonymous').join(' → ')})`,
    async function* () {
      const iterator = piped[Symbol.asyncIterator]();
      while (true) {
        const { value, done } = await iterator.next();
        if (done) break;
        yield value;
      }
    }
  );

  return sink;
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

