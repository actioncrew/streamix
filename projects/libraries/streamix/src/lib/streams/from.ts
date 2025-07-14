import { createStream, Stream } from "../abstractions";

/**
 * Creates a stream from an async iterable or a synchronous iterable.
 *
 * - Supports any source that implements `[Symbol.asyncIterator]` or `[Symbol.iterator]`.
 * - Converts the source into a stream that emits all its values in order.
 */
export function from<T = any>(source: AsyncIterable<T> | Iterable<T>): Stream<T> {
  return createStream<T>("from", async function* () {
    // Wrap the iterable with the stream generator
    for await (const value of source) {
      yield value;
    }
  });
}
