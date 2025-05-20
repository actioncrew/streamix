import { eachValueFrom } from "../converters";
import { Operator } from "./operator";
import { createReceiver, Receiver } from "./receiver";
import { createSubscription, Subscription } from "./subscription";

export type Stream<T = any> = {
  type: "stream" | "subject";
  name?: string;
  subscribe: (callback?: ((value: T) => void) | Receiver<T>) => Subscription;
  pipe: (...steps: Operator[]) => Stream<any>;
};

export function pipeStream<T = any>(stream: Stream<T>, ...steps: Operator[]): Stream<any> {
  const base = eachValueFrom(stream);
  const piped = steps.reduce<AsyncIterable<any>>((iter, op) => op.apply(iter), base);

  return createStream(
    `pipe(${steps.map(op => op.name ?? 'anonymous').join(" → ")})`,
    async function* () {
      const iterator = piped[Symbol.asyncIterator]();
      try {
        while (true) {
          const { value, done } = await iterator.next();
          if (done) break;
          yield value;
        }
      } catch (err) {
        if (iterator.throw) await iterator.throw(err);
        throw err;
      } finally {
        if (iterator.return) {
          await iterator.return();
        }
      }
    }
  );
}

export function createStream<T>(name: string, generatorFn: () => AsyncGenerator<T, void, unknown>): Stream<T> {
  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    const iterator: AsyncGenerator<T, void, unknown> | null = generatorFn();
    const subscription = createSubscription<T>(async () => {
      await iterator.return();
    });

    (async () => {
      try {
        for await (const value of iterator) {
          if (subscription.unsubscribed) {
            break;
          }
          receiver.next?.(value);
        }
      } catch (err: any) {
        if (iterator?.throw) await iterator.throw(err);
        receiver.error?.(err);
      } finally {
        receiver.complete?.();
      }
    })();

    return subscription;
  };

  return { type: "stream", name, subscribe, pipe: function(...steps) { return pipeStream<T>(this, ...steps); }}
}
