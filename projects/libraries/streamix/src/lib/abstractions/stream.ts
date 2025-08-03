import { eachValueFrom, firstValueFrom } from "../converters";
import { Operator } from "./operator";
import { CallbackReturnType, createReceiver, Receiver } from "./receiver";
import { createSubscription, Subscription } from "./subscription";

/**
 * Represents a chain of operators where each output feeds into the next input.
 */
export type OperatorChain<T> = [Operator<T, any>, ...Operator<any, any>[]];

/**
 * Recursively computes the final output type after applying a chain of operators.
 */
export type GetChainOutput<T, Chain extends Operator<any, any>[]> = 
  Chain extends []
    ? T
    : Chain extends [infer First, ...infer Rest]
      ? First extends Operator<T, infer U>
        ? Rest extends Operator<any, any>[]
          ? GetChainOutput<U, Rest>
          : never
        : never
      : never;

/**
 * Represents a reactive stream that supports subscriptions and operator chaining.
 */
export type Stream<T = any> = {
  type: "stream" | "subject";
  name?: string;

  pipe<A>(op1: Operator<T, A>): Stream<A>;

  pipe<A, B>(
    op1: Operator<T, A>,
    op2: Operator<A, B>
  ): Stream<B>;

  pipe<A, B, C>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>
  ): Stream<C>;

  pipe<A, B, C, D>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>,
    op4: Operator<C, D>
  ): Stream<D>;

  pipe<A, B, C, D, E>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>,
    op4: Operator<C, D>,
    op5: Operator<D, E>
  ): Stream<E>;

  pipe<A, B, C, D, E, F>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>,
    op4: Operator<C, D>,
    op5: Operator<D, E>,
    op6: Operator<E, F>
  ): Stream<F>;

  pipe<A, B, C, D, E, F, G>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>,
    op4: Operator<C, D>,
    op5: Operator<D, E>,
    op6: Operator<E, F>,
    op7: Operator<F, G>
  ): Stream<G>;

  pipe<A, B, C, D, E, F, G, H>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>,
    op4: Operator<C, D>,
    op5: Operator<D, E>,
    op6: Operator<E, F>,
    op7: Operator<F, G>,
    op8: Operator<G, H>
  ): Stream<H>;

  pipe<Chain extends OperatorChain<T>>(
    ...operators: Chain
  ): Stream<GetChainOutput<T, Chain>>;

  pipe(
    ...operators: Operator<any, any>[]
  ): Stream<any>;
  
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
    // Attach pipe with full overload + recursive support
    pipe(...operators: Operator<any, any>[]) {
      return pipeStream(this, ...operators as [any]);
    },
    subscribe,
    query: async function (): Promise<T> {
      return await firstValueFrom(this);
    }
  };
}

/**
 * Pipes a stream through a series of transformation operators,
 * returning a new derived stream.
 */
export function pipeStream<TIn>(
  source: Stream<TIn>,
  ...operators: Operator<any, any>[]
): Stream<any> {
  const createTransformedIterator = (): AsyncIterator<any> => {
    const baseIterator = eachValueFrom(source)[Symbol.asyncIterator]() as AsyncIterator<TIn>;
    return operators.reduce<AsyncIterator<any>>(
      (iterator: AsyncIterator<any>, op: Operator<any, any>) => op.apply(iterator),
      baseIterator
    );
  };

  return {
    name: "piped",
    type: "stream",
    // Same pipe logic with full overload + recursive support
    pipe(...nextOps: Operator<any, any>[]): Stream<any> {
      return pipeStream(this, ...nextOps);
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

      return createSubscription(async () => {
        abortController.abort();
        if (transformedIterator.return) {
          await transformedIterator.return().catch(() => {});
        }
      });
    },
    async query() {
      return firstValueFrom(this);
    }
  };
}
