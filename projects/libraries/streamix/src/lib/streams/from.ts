import { createStream, Stream } from "../abstractions";

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

  return createStream<T>("from", generator);
}
