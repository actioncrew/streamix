import { eachValueFrom, firstValueFrom } from "../converters";
import { createStreamContext, PipelineContext, StreamResult } from "./context";
import { Operator, OperatorChain, patchOperator } from "./operator";
import { CallbackReturnType, createReceiver, Receiver } from "./receiver";
import { createSubscription, Subscription } from "./subscription";


/**
 * A specialized asynchronous iterator for streams that yields {@link StreamResult} objects.
 *
 * This interface extends the standard `AsyncIterator` contract by returning
 * {@link StreamResult} instead of plain `IteratorResult`. This allows the stream
 * to communicate both actual values and *phantom emissions* (values that were
 * produced but filtered out or suppressed by pipeline operators).
 *
 * @template T The type of the values produced by this iterator.
 */
export interface StreamIterator<T = any> {
  /**
   * Retrieves the next result from the stream.
   *
   * @param value An optional value to send into the iterator.
   * @returns A promise resolving to the next {@link StreamResult}.
   */
  next(value?: T): Promise<StreamResult>;

  /**
   * Signals that the consumer is done with the stream and
   * allows cleanup logic in the iterator.
   *
   * @param value An optional value to return from the stream.
   * @returns A promise resolving to the final {@link StreamResult}.
   */
  return?(value?: any): Promise<StreamResult>;

  /**
   * Propagates an error into the iterator, allowing it to handle
   * or propagate the exception downstream.
   *
   * @param e An optional error to throw inside the iterator.
   * @returns A promise resolving to the next {@link StreamResult}.
   */
  throw?(e?: any): Promise<StreamResult>;
}

/**
 * A specialized async generator used in Streamix.
 *
 * Unlike the native `AsyncGenerator`, this yields {@link StreamResult}
 * values, which may include phantom emissions in addition to normal
 * `IteratorResult` values.
 *
 * @template T The type of values emitted by the generator.
 */
export interface StreamGenerator<T> extends StreamIterator<T> {
  [Symbol.asyncIterator](): StreamGenerator<T>;
}

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
  generatorFn: () => AsyncGenerator<T, void, unknown>,
  context?: PipelineContext
): Stream<T> {
  void context;
  const activeSubscriptions = new Set<{
    receiver: Receiver<T>;
    subscription: Subscription;
  }>();
  let isRunning = false;
  let abortController = new AbortController();

  const subscribe = (
    callbackOrReceiver?: ((value: T) => CallbackReturnType) | Receiver<T>
  ): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    const subscription = createSubscription(() => {
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
          const result = winner.result;
          if (result.done) break;

          const subscribers = Array.from(activeSubscriptions);
          await Promise.all(
            subscribers.map(async ({ receiver }) => {
              try {
                await receiver.next?.(result.value);
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
  const pipe = ((...operators: Operator<any, any>[]) => {
    return pipeStream(self, operators, context);
  }) as OperatorChain<T>;

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
  operators: [...Ops],
  context?: PipelineContext
): Stream<any> {
  const pipedStream: Stream<any> = {
    name: `${source.name}-sink`,
    type: 'stream',

    pipe: ((...nextOps: Operator<any, any>[]) => {
      const allOps = [...operators, ...nextOps];
      return pipeStream(source, allOps, context);
    }) as OperatorChain<any>,

    subscribe(cb?: ((value: any) => CallbackReturnType) | Receiver<any>) {
      const receiver = createReceiver(cb);
      let streamContext = context ? createStreamContext(this, context) : undefined;
      const sourceIterator = eachValueFrom(source)[Symbol.asyncIterator]() as StreamIterator<TIn>;
      let currentIterator: StreamIterator<any> = sourceIterator;

      for (const op of operators) {
        const patchedOp = patchOperator(op);
        currentIterator = patchedOp.apply(currentIterator, streamContext);
      }

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
              currentIterator.next().then(result => ({ result }))
            ]);

            if ("aborted" in winner || signal.aborted) break;
            const result = winner.result;
            if (result.done) break;

            await receiver.next?.(result.value);
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
        if (currentIterator.return) {
          await currentIterator.return().catch(() => {});
        }
      });
    },

    async query() {
      return firstValueFrom(pipedStream);
    }
  };

  return pipedStream;
}
