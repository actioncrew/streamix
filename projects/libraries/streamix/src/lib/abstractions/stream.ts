import { eachValueFrom } from "../converters";
import { Operator } from "./operator";
import { createReceiver, Receiver } from "./receiver";
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

  const piped = steps.reduce<AsyncIterable<any>>((iter, op) => {
    return op.apply(iter);
  }, base);

  return createStream(
    `pipe(${steps.map(op => op.name ?? 'anonymous').join(" → ")})`,
    async function* () {
      for await (const value of piped) {
        yield value;
      }
    }
  );
}

// The stream factory function
export function createStream<T>(
  name: string,
  generatorFn: () => AsyncGenerator<T, void, unknown>
): Stream<T> {
  const subscribe = (
    callbackOrReceiver?: ((value: T) => void) | Receiver<T>
  ): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    const subscription = createSubscription<T>();

    (async () => {
      try {
        for await (const value of generatorFn()) {
          if (subscription.unsubscribed) break;
          receiver.next?.(value);
        }
        receiver.complete?.();
      } catch (err: any) {
        receiver.error?.(err);
      }
    })();

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

