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
      startMulticastLoop(generatorFn, abortController.signal);
    }

    return subscription;
  };

  const startMulticastLoop = (genFn: () => AsyncGenerator<T, void, unknown>, signal: AbortSignal) => {
    (async () => {
      let currentIterator: AsyncIterator<T> | null = null;

      const abortPromise = new Promise<void>((resolve) => {
        if (signal.aborted) {
          resolve();
        } else {
          signal.addEventListener("abort", () => resolve(), { once: true });
        }
      });

      try {
        currentIterator = genFn()[Symbol.asyncIterator]();
        while (true) {
          const winner = await Promise.race([
            abortPromise.then(() => ({ aborted: true })),
            currentIterator.next().then(result => ({ result }))
          ]);

          if ('aborted' in winner || signal.aborted) break;
          if (winner.result.done) break;

          const subscribers = Array.from(activeSubscriptions);
          await Promise.all(
            subscribers.map(async ({ receiver }) => {
              try {
                if (receiver.next) {
                  await receiver.next(winner.result.value);
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
    })();
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
      const transformedIterator = createTransformedIterator();

      const abortController = new AbortController();
      const { signal } = abortController;

      const abortPromise = new Promise<void>((resolve) => {
        if (signal.aborted) {
          resolve();
        } else {
          signal.addEventListener("abort", () => resolve(), { once: true });
        }
      });

      (async () => {
        try {
          while (true) {
            const winner = await Promise.race([
              abortPromise.then(() => ({ aborted: true })),
              transformedIterator.next().then(result => ({ result }))
            ]);

            if ('aborted' in winner || signal.aborted) break;
            if (winner.result.done) break;

            await receiver.next(winner.result.value);
          }
        } catch (err: any) {
          if (!signal.aborted) {
            await receiver.error?.(err);
          }
        } finally {
          await receiver.complete?.();
        }
      })();

      return createSubscription(() => {
        abortController.abort();
        if (transformedIterator.return) {
          transformedIterator.return().catch(() => {});
        }
      });
    },
    pipe(...ops) {
      return pipeStream(this, ...ops);
    }
  } as Stream;
}
