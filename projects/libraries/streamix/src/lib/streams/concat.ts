import { createStream, createSubscription, Receiver, Stream, Subscription } from "../abstractions";
import { eachValueFrom } from "../converters";

/**
 * Concatenates multiple streams by subscribing to each one sequentially.
 *
 * - Emits all values from the first stream, then moves to the next.
 * - Completes when all source streams have completed.
 * - Propagates errors from any source stream immediately.
 */
export function concat<T = any>(...sources: Stream<T>[]): Stream<T> {
  const controller = new AbortController();
  const signal = controller.signal;

  async function* generator() {
    for (const source of sources) {
      if (signal.aborted) break;

      const iterator = eachValueFrom(source);

      try {
        for await (const value of iterator) {
          if (signal.aborted) break;
          yield value;
        }
      } catch (error) {
        throw error;
      } finally {
        // Attempt to close iterator early on abort or completion
        if (iterator.return) {
          try {
            await iterator.return(undefined);
          } catch {
            // ignore
          }
        }
      }
    }
  }

  const stream = createStream<T>("concat", generator);

  // Override subscribe to abort on unsubscribe
  const originalSubscribe = stream.subscribe;
  stream.subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const subscription = originalSubscribe.call(stream, callbackOrReceiver);

    return createSubscription(() => {
      controller.abort();
      subscription.unsubscribe();
    });
  };

  return stream;
}
