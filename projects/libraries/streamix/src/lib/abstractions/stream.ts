import { eachValueFrom, firstValueFrom } from "../converters";
import { Operator, OperatorChain } from "./operator";
import { CallbackReturnType, createReceiver, Receiver } from "./receiver";
import { scheduler } from "./scheduler";
import { createSubscription, Subscription } from "./subscription";

/**
 * Represents a reactive stream that supports subscriptions and operator chaining.
 *
 * A stream is a sequence of values over time that can be subscribed to for notifications.
 * It is a foundational concept in reactive programming, providing a unified way to handle
 * asynchronous data flows, such as events, data from APIs, or values from an async generator.
 *
 * @template T The type of the values emitted by the stream.
 */
export type Stream<T = any> = {
  /**
   * A type discriminator to differentiate between stream types.
   * `stream` indicates a cold, multicastable stream originating from a generator.
   * `subject` would indicate a hot stream that can be manually controlled.
   */
  type: "stream" | "subject";
  /**
   * An optional, human-readable name for the stream, useful for debugging and logging.
   */
  name?: string;
  /**
   * A method to chain stream operators.
   *
   * This is a critical part of the stream's composability. It takes one or more
   * `Operator`s and returns a new `Stream` that applies each operator's
   * transformation in order.
   * @example
   * ```typescript
   * const numberStream = createStream('numbers', async function*() {
   *   yield 1; yield 2; yield 3;
   * });
   *
   * const doubledStream = numberStream.pipe(
   *   map(value => value * 2),
   *   filter(value => value > 3)
   * );
   * ```
   */
  pipe: OperatorChain<T>;
  /**
   * Subscribes a listener to the stream to receive emitted values.
   *
   * Subscribing starts the stream's execution. Multiple subscriptions will
   * multicast the same values to all listeners.
   *
   * @param callback An optional function or `Receiver` object to handle
   * values, errors, and completion of the stream.
   * @returns A `Subscription` object which can be used to unsubscribe and
   * stop listening to the stream.
   */
  subscribe: (callback?: ((value: T) => CallbackReturnType) | Receiver<T>) => Subscription;
  /**
   * Queries the stream for its first emitted value and resolves when that value arrives.
   *
   * This method is useful for scenarios where you only need a single value from the stream,
   * such as a one-off API request or a single button click. It automatically unsubscribes
   * after the first value is received.
   *
   * @returns A promise that resolves with the first value emitted by the stream.
   */
  query: () => Promise<T>;
};

/**
 * Creates a multicast stream from an async generator function.
 *
 * A **multicast stream** (also known as a hot stream) starts executing its work
 * (running the `generatorFn`) when the first subscriber joins. All subsequent
 * subscriptions will share the same underlying generator execution, receiving
 * the same values from that single source. This is different from a typical
 * cold stream, where each subscription would trigger a new, independent execution.
 *
 * The stream manages the subscription lifecycle and performs graceful teardown
 * of the generator when there are no more active subscribers.
 *
 * @template T The type of the values that the stream will emit.
 * @param name A human-readable name for the stream, useful for debugging.
 * @param generatorFn An async generator function that defines the source of the stream's
 * values. The generator's `yield` statements push values to the stream.
 * @returns A new `Stream` instance.
 */
export function createStream<T>(
  name: string,
  generatorFn: () => AsyncGenerator<T, void, unknown>
): Stream<T> {
  const activeSubscriptions = new Set<{ receiver: Receiver<T>; subscription: Subscription }>();
  let isRunning = false;
  let abortController = new AbortController();

  const subscribe = (
    callbackOrReceiver?: ((value: T) => CallbackReturnType) | Receiver<T>
  ): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    let subscription: Subscription;
    subscription = createSubscription(async () => {
      for (const sub of activeSubscriptions) {
        if (sub.subscription === subscription) {
          activeSubscriptions.delete(sub);
          // Trigger completion for this specific subscriber
          scheduler.enqueue(async () => {
            try {
              await sub.receiver.complete?.();
            } catch (error) {
              console.warn("Error completing cancelled receiver:", error);
            }
          });
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

  const startMulticastLoop = (genFn: () => AsyncGenerator<T>, signal: AbortSignal) => {
    (async () => {
      let iterator: AsyncIterator<T> | null = null;

      const abortPromise = new Promise<void>((resolve) => {
        if (signal.aborted) resolve();
        else signal.addEventListener("abort", () => resolve(), { once: true });
      });

      try {
        iterator = genFn()[Symbol.asyncIterator]();
        while (true) {
          const winner = await Promise.race([
            abortPromise.then(() => ({ aborted: true } as const)),
            iterator.next().then(result => ({ result }))
          ]);

          if ("aborted" in winner || signal.aborted) break;
          if (winner.result.done) break;

          const value = winner.result.value;
          const subscribers = Array.from(activeSubscriptions);

          // Deliver value only to active subscribers
          scheduler.enqueue(async () => {
            await Promise.all(subscribers.map(async ({ receiver, subscription }) => {
              if (!subscription.unsubscribed) {
                try {
                  await receiver.next?.(value);
                } catch (err) {
                  scheduler.enqueue(async () => {
                    try {
                      await receiver.error?.(err instanceof Error ? err : new Error(String(err)));
                    } catch {}
                  });
                }
              }
            }));
          });
        }
      } catch (err) {
        if (!signal.aborted) {
          const error = err instanceof Error ? err : new Error(String(err));
          const subscribers = Array.from(activeSubscriptions);
          scheduler.enqueue(async () => {
            await Promise.all(subscribers.map(async ({ receiver, subscription }) => {
              if (!subscription.unsubscribed) {
                await receiver.error?.(error);
              }
            }));
          });
        }
      } finally {
        if (iterator?.return) {
          try { await iterator.return(); } catch {}
        }
        // Only complete remaining subscribers on natural completion
        if (!signal.aborted) {
          const subscribers = Array.from(activeSubscriptions);
          scheduler.enqueue(async () => {
            await Promise.all(subscribers.map(async ({ receiver, subscription }) => {
              if (!subscription.unsubscribed) {
                try { await receiver.complete?.(); } catch {}
              }
            }));
          });
        }
        isRunning = false;
      }
    })();
  };

  let self: Stream<T>;
  const pipe = ((...operators: Operator<any, any>[]) => pipeStream(self, operators)) as OperatorChain<T>;

  self = {
    type: "stream",
    name,
    pipe,
    subscribe,
    query: () => firstValueFrom(self),
  };

  return self;
}

/**
 * Pipes a stream through a series of transformation operators,
 * returning a new derived stream.
 */
export function pipeStream<TIn, Ops extends Operator<any, any>[]>(source: Stream<TIn>, operators: [...Ops]): Stream<any> {
  const pipedStream: Stream<any> = {
    name: `${source.name}-sink`,
    type: "stream",
    pipe: ((...nextOps: Operator<any, any>[]) => pipeStream(source, [...operators, ...nextOps])) as OperatorChain<any>,

    subscribe(cb?: ((value: any) => CallbackReturnType) | Receiver<any>) {
      const receiver = createReceiver(cb);
      const sourceIterator = eachValueFrom(source)[Symbol.asyncIterator]() as AsyncIterator<TIn>;
      let currentIterator: AsyncIterator<any> = sourceIterator;

      for (const op of operators) {
        currentIterator = op.apply(currentIterator);
      }

      const abortController = new AbortController();
      const { signal } = abortController;

      const abortPromise = new Promise<void>((resolve) => {
        if (signal.aborted) resolve();
        else signal.addEventListener("abort", () => resolve(), { once: true });
      });

      const subscription = createSubscription(async () => {
        abortController.abort();
        if (currentIterator.return) {
          await currentIterator.return().catch(() => {});
        }
        // Trigger completion when unsubscribing
        scheduler.enqueue(async () => {
          await receiver.complete?.();
        });
      });

      (async () => {
        try {
          while (true) {
            const winner = await Promise.race([
              abortPromise.then(() => ({ aborted: true } as const)),
              currentIterator.next().then(result => ({ result }))
            ]);
            if ("aborted" in winner || signal.aborted) break;
            const result = winner.result;
            if (result.done) break;

            scheduler.enqueue(async () => {
              if (!subscription.unsubscribed) {
                try {
                  await receiver.next?.(result.value);
                } catch (err) {
                  scheduler.enqueue(async () => {
                    try {
                      await receiver.error?.(err instanceof Error ? err : new Error(String(err)));
                    } catch {}
                  });
                }
              }
            });
          }
        } catch (err: any) {
          if (!signal.aborted && !subscription.unsubscribed) {
            scheduler.enqueue(async () => await receiver.error?.(err));
          }
        } finally {
          // Complete on natural completion (not abort)
          if (!signal.aborted) {
            scheduler.enqueue(async () => {
              if (!subscription.unsubscribed) {
                await receiver.complete?.();
              }
            });
          }
        }
      })();

      return subscription;
    },

    async query() {
      return firstValueFrom(pipedStream);
    },
  };

  return pipedStream;
}