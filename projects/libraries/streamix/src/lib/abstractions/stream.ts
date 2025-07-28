import { eachValueFrom } from "../converters";
import { Operator } from "./operator";
import { CallbackReturnType, createReceiver, Receiver } from "./receiver";
import { createSubscription, Subscription } from "./subscription";

export type Stream<T = any> = {
  type: "stream" | "subject";
  name?: string;
  subscribe: (callback?: ((value: T) => void) | Receiver<T>) => Subscription;
  pipe: (...steps: Operator[]) => Stream<any>;
};

export function createStream<T>(
  name: string,
  generatorFn: () => AsyncGenerator<T, void, unknown>,
): Stream<T> {
  const activeSubscriptions = new Set<{
    receiver: Receiver<T>;
    subscription: Subscription<T>;
  }>();
  let isRunning = false;
  let abortController = new AbortController();

  const subscribe = (
    callbackOrReceiver?: ((value: T) => CallbackReturnType) | Receiver<T>
  ): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    const subscription = createSubscription<T>(() => {
      for (const sub of activeSubscriptions) {
        if (sub.subscription === subscription) {
          activeSubscriptions.delete(sub);
          try {
            if (sub.receiver.complete) {
              sub.receiver.complete();
            }
          } catch (error) {
            console.warn("Error completing cancelled receiver:", error);
          }
          break;
        }
      }

      if (activeSubscriptions.size === 0) {
        abortController.abort();
        isRunning = false;
      }
    });

    activeSubscriptions.add({ receiver, subscription });

    if (!isRunning) {
      isRunning = true;
      abortController = new AbortController();
      startMulticastLoop(generatorFn);
    }

    return subscription;
  };

  const startMulticastLoop = async (genFn: () => AsyncGenerator<T, void, unknown>) => {
    const signal = abortController.signal;
    let currentIterator: AsyncIterator<T> | null = null;

    try {
      currentIterator = genFn()[Symbol.asyncIterator]();

      const abortPromise = new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () => reject("aborted"), { once: true });
      });

      while (!signal.aborted) {
        let result: IteratorResult<T> | { aborted: true };

        try {
          result = await Promise.race([
            currentIterator.next(),
            abortPromise
          ]) as IteratorResult<T>;
        } catch (err) {
          if (err === "aborted") break;
          throw err;
        }

        if ('aborted' in result) break;
        if (result.done) break;

        const subscribers = Array.from(activeSubscriptions);
        await Promise.all(
          subscribers.map(async ({ receiver }) => {
            try {
              if (receiver.next) {
                await receiver.next(result.value);
              }
            } catch (error) {
              console.warn("Subscriber error:", error);
            }
          })
        );
      }
    } catch (err) {
      if (!signal.aborted) {
        const error = err instanceof Error ? err : new Error(String(err));
        const subscribers = Array.from(activeSubscriptions);
        await Promise.all(
          subscribers.map(async ({ receiver }) => {
            try {
              if (receiver.error) {
                await receiver.error(error);
              }
            } catch {}
          })
        );
      }
    } finally {
      if (currentIterator?.return) {
        try {
          await currentIterator.return(undefined);
        } catch {}
      }

      const subscribers = Array.from(activeSubscriptions);
      await Promise.all(
        subscribers.map(async ({ receiver }) => {
          try {
            if (receiver.complete) {
              await receiver.complete();
            }
          } catch {}
        })
      );

      isRunning = false;
    }
  };

  const stream: Stream<T> = {
    type: "stream",
    name,
    subscribe,
    pipe(...steps: Operator[]) {
      return pipeStream(this, ...steps);
    }
  } as any;

  return stream;
}

export function pipeStream<T = any>(source: Stream<T>, ...steps: Operator[]): Stream<any> {
  const createTransformedIterator = () => {
    const baseIterator = eachValueFrom(source)[Symbol.asyncIterator]();
    return steps.reduce<AsyncIterator<T>>((iterator, op) => op.apply(iterator), baseIterator);
  };

  return {
    name: 'piped',
    type: 'stream',
    subscribe: (cb) => {
      const receiver = createReceiver(cb);
      let active = true;

      const transformedIterator = createTransformedIterator();

      (async () => {
        try {
          while (active) {
            const result = await transformedIterator.next();
            if (result.done) break;
            await receiver.next(result.value);
          }
        } catch (err: any) {
          await receiver.error(err);
        } finally {
          await receiver.complete();
        }
      })();

      return createSubscription(() => {
        active = false;
        if (transformedIterator.return) {
          transformedIterator.return().catch(() => {});
        }
      });
    },
    [Symbol.asyncIterator]() {
      return createTransformedIterator();
    },
    pipe(...ops) {
      return pipeStream(this, ...ops);
    }
  } as Stream;
}
