import { createStream, createSubscription, Receiver, Stream, Subscription } from "../abstractions";

/**
 * Creates a stream from an async iterable or a synchronous iterable.
 *
 * - Supports any source that implements `[Symbol.asyncIterator]` or `[Symbol.iterator]`.
 * - Converts the source into a stream that emits all its values in order.
 */
export function from<T = any>(source: AsyncIterable<T> | Iterable<T>): Stream<T> {
  const controller = new AbortController();
  const signal = controller.signal;

  async function* generator() {
    try {
      for await (const value of source) {
        if (signal.aborted) break;
        yield value;
      }
    } catch (err) {
      if (!signal.aborted) throw err;
    }
  }

  const stream = createStream<T>("from", generator);

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
