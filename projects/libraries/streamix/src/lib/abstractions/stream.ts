import { Operator } from "./operator";
import { createReceiver, Receiver } from "./receiver";
import { createSubscription, Subscription } from "./subscription";
import { eachValueFrom } from "../converters";

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
  const base = eachValueFrom(stream);

  const piped = steps.reduce((iter, op) => op.apply(iter), base);

  return createStream(
    `pipe(${steps.map(op => op.name).join(" → ")})`,
    () => piped[Symbol.asyncIterator]()
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
          if (subscription.closed) break;
          receiver.next?.(value);
        }
        receiver.complete?.();
      } catch (err) {
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
    
