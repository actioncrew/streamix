import { eachValueFrom, firstValueFrom } from "../converters";
import { Operator } from "./operator";
import { CallbackReturnType, createReceiver, Receiver } from "./receiver";
import { createSubscription, Subscription } from "./subscription";

/**
 * Represents a reactive stream that supports subscriptions and operator chaining.
 */
export type Stream<T = any> = {
  type: "stream" | "subject";
  name?: string;
  pipe: <Chain extends OperatorChain<T>>(
    ...steps: Chain
  ) => Stream<GetChainOutput<T, Chain>>;
  subscribe: (callback?: ((value: T) => void) | Receiver<T>) => Subscription;
  query: () => Promise<T>;
};

/**
 * A more flexible operator chain type that handles spread operations properly.
 * This allows both strict typing and dynamic operator arrays.
 */
export type OperatorChain<TIn> =
  | readonly []
  | readonly [Operator<TIn, any>, ...Operator<any, any>[]]
  | Operator<any, any>[];

/**
 * Infers the output type of an operator chain by following the type transformations.
 * Handles `never` types properly for throwing operators.
 */
export type GetChainOutput<TIn, TChain extends readonly Operator<any, any>[]> =
  TChain extends readonly []
    ? TIn
    : TChain extends readonly [Operator<TIn, infer TOut>]
      ? TOut
    : TChain extends readonly [Operator<TIn, infer TMid>, ...infer Rest]
      ? Rest extends readonly Operator<any, any>[]
        ? GetChainOutput<TMid, Rest>
        : TMid
    : TIn;
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
            abortPromise.then(() => ({ aborted: true })),
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
            await currentIterator.return(undefined);
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

  return {
    type: "stream",
    name,
    pipe<Chain extends OperatorChain<T>>(
      ...steps: Chain
    ): Stream<GetChainOutput<T, Chain>> {
      return pipeStream(this, ...steps);
    },
    subscribe,
    query: async function (): Promise<T> {
      return await firstValueFrom(this);
    },
  };
}

/**
 * Pipes a stream through a series of transformation operators,
 * returning a new derived stream.
 */
export function pipeStream<
  TIn,
  Chain extends OperatorChain<TIn>
>(
  source: Stream<TIn>,
  ...steps: Chain
): Stream<GetChainOutput<TIn, Chain>> {
  const createTransformedIterator = (): AsyncIterator<any> => {
    const baseIterator = eachValueFrom(source)[Symbol.asyncIterator]() as AsyncIterator<TIn>;
    return steps.reduce<AsyncIterator<any>>(
      (iterator: AsyncIterator<any>, op: Operator<any, any>) => op.apply(iterator),
      baseIterator
    );
  };

  return {
    name: "piped",
    type: "stream",
    pipe<NextChain extends OperatorChain<GetChainOutput<TIn, Chain>>>(
      ...ops: NextChain
    ): Stream<GetChainOutput<GetChainOutput<TIn, Chain>, NextChain>> {
      return pipeStream(this, ...ops);
    },
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
              abortPromise.then(() => ({ aborted: true })),
              await transformedIterator.next().then(result => ({ result }))
            ]);

            if ("aborted" in winner || signal.aborted) break;
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
    async query(): Promise<GetChainOutput<TIn, Chain>> {
      return await firstValueFrom(this);
    }
  };
  }
