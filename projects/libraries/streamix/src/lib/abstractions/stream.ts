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
  pipe: <Chain extends Operator<any, any>[]>(
    ...steps: Chain
  ) => Stream<GetChainOutput<T, Chain>>;
  subscribe: (callback?: ((value: T) => void) | Receiver<T>) => Subscription;
  query: () => Promise<T>;
};

/**
 * Recursively represents a tuple (chain) of operators applied sequentially,
 * transforming an input type `TIn` to an output type `TOut`.
 *
 * The third generic `Ts` tracks the actual operator tuple being processed,
 * allowing recursive inference along the chain.
 */
export type OperatorChain<
  TIn,
  TOut,
  Ts extends any[] = []
> =
  Ts extends [infer Head, ...infer Tail]
    ? Head extends Operator<infer A, infer B>
      ? [Operator<TIn, A>, ...OperatorChain<B, TOut, Tail>]
      : []
    : [] | [Operator<TIn, TOut>];

/**
 * Infers the output type of an operator chain.
 *
 * Given an input type `TIn` and a chain of operators (`TChain`),
 * this type resolves to the final output type after all operators are applied.
 */
export type GetChainOutput<TIn, TChain extends Operator<any, any>[]> =
  TChain extends [...any[], Operator<any, infer TOut>] ? TOut : TIn;

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
    pipe<Chain extends Operator<any, any>[]>(
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
  TIn = any,
  Chain extends Operator<any, any>[] = []
>(
  source: Stream<TIn>,
  ...steps: Chain
): Stream<GetChainOutput<TIn, Chain>> {
  const createTransformedIterator = (): AsyncIterator<any> => {
    const baseIterator = eachValueFrom(source)[Symbol.asyncIterator]();
    return (steps as Operator<any, any>[]).reduce<AsyncIterator<any>>(
      (iterator: AsyncIterator<any>, op: Operator<any, any>) => op.apply(iterator),
      baseIterator
    );
  };

  return {
    name: `piped(${source.name ?? "stream"})`,
    type: "stream",
    pipe<NextChain extends Operator<any, any>[]>(
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
              transformedIterator.next().then(result => ({ result }))
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
