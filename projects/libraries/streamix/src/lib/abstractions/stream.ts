import { eachValueFrom, firstValueFrom } from "../converters";
import { Operator, OperatorChain } from "./operator";
import { CallbackReturnType, createReceiver, Receiver } from "./receiver";
import { createSubscription, Subscription } from "./subscription";

/**
 * Utility: Recursively compute output type after chaining operators
 */
type ChainOperators<T, Ops extends Operator<any, any>[]> =
  Ops extends []
    ? T
    : Ops extends [infer First, ...infer Rest]
      ? First extends Operator<any, infer U>
        ? Rest extends Operator<any, any>[]
          ? ChainOperators<U, Rest>
          : U
        : never
      : never;

/**
 * Represents a reactive stream that supports subscriptions and operator chaining.
 */
export type Stream<T = any> = {
  type: "stream" | "subject";
  name?: string;
  pipe: OperatorChain<T>;
  subscribe: (callback?: ((value: T) => CallbackReturnType) | Receiver<T>) => Subscription;
  query: () => Promise<T>;
};

/**
 * Creates a cold stream from an async generator function.
 * Handles multicasting, subscription lifecycle, and graceful teardown.
 */
export function createStream<T>(
  name: string,
  generatorFn: () => AsyncGenerator<T, void, unknown>
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
            sub.receiver.complete?.();
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

  const startMulticastLoop = (
    genFn: () => AsyncGenerator<T, void, unknown>,
    signal: AbortSignal
  ) => {
    (async () => {
      let currentIterator: AsyncIterator<T> | null = null;

      const abortPromise = new Promise<void>((resolve) => {
        if (signal.aborted) resolve();
        else signal.addEventListener("abort", () => resolve(), { once: true });
      });

      try {
        currentIterator = genFn()[Symbol.asyncIterator]();
        while (true) {
          const winner = await Promise.race([
            abortPromise.then(() => ({ aborted: true } as const)),
            currentIterator.next().then(result => ({ result }))
          ]);

          if ("aborted" in winner || signal.aborted) break;
          if (winner.result.done) break;

          const subscribers = Array.from(activeSubscriptions);
          await Promise.all(
            subscribers.map(async ({ receiver }) => {
              try {
                await receiver.next?.(winner.result.value);
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
                await receiver.error?.(error);
              } catch {}
            })
          );
        }
      } finally {
        if (currentIterator?.return) {
          try {
            await currentIterator.return();
          } catch {}
        }

        const subscribers = Array.from(activeSubscriptions);
        await Promise.all(
          subscribers.map(async ({ receiver }) => {
            try {
              await receiver.complete?.();
            } catch {}
          })
        );

        isRunning = false;
      }
    })();
  };

  // We must define self first so pipe can capture it
  let self: Stream<T>;

  // Create pipe function that uses self
  const pipe: OperatorChain<T> = ((...operators: Operator<any, any>[]) => {
    return pipeStream(self, ...operators);
  });

  // Now define self, closing over pipe
  self = {
    type: "stream",
    name,
    pipe,
    subscribe,
    query: () => firstValueFrom(self)
  };

  return self;
}

/**
 * Pipes a stream through a series of transformation operators,
 * returning a new derived stream.
 */
export function pipeStream<TIn, Ops extends Operator<any, any>[]>(
  source: Stream<TIn>,
  ...operators: [...Ops]
): Stream<ChainOperators<TIn, Ops>> {
  const createTransformedIterator = (): AsyncIterator<ChainOperators<TIn, Ops>> => {
    const baseIterator = eachValueFrom(source)[Symbol.asyncIterator]() as AsyncIterator<TIn>;
    return operators.reduce<AsyncIterator<any>>(
      (iter, op) => op.apply(iter),
      baseIterator
    );
  };

  const pipedStream: Stream<ChainOperators<TIn, Ops>> = {
    name: "piped",
    type: "stream",
    pipe: ((...nextOps: Operator<any, any>[]) => {
      return pipeStream(pipedStream, ...nextOps);
    }),

    subscribe(cb) {
      const receiver = createReceiver(cb);
      const transformedIterator = createTransformedIterator();
      const abortController = new AbortController();
      const { signal } = abortController;

      const abortPromise = new Promise<void>((resolve) => {
        if (signal.aborted) resolve();
        else signal.addEventListener("abort", () => resolve(), { once: true });
      });

      (async () => {
        try {
          while (true) {
            const winner = await Promise.race([
              abortPromise.then(() => ({ aborted: true } as const)),
              transformedIterator.next().then(result => ({ result }))
            ]);

            if ("aborted" in winner || signal.aborted) break;
            if (winner.result.done) break;

            await receiver.next?.(winner.result.value);
          }
        } catch (err: any) {
          if (!signal.aborted) {
            await receiver.error?.(err);
          }
        } finally {
          await receiver.complete?.();
        }
      })();

      return createSubscription(async () => {
        abortController.abort();
        if (transformedIterator.return) {
          await transformedIterator.return().catch(() => {});
        }
      });
    },

    async query() {
      return await firstValueFrom(pipedStream);
    }
  };

  return pipedStream;
}
