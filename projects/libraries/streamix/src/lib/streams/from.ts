import { createStream, PipelineContext, Stream } from "../abstractions";

/**
 * Creates a stream from an asynchronous or synchronous iterable.
 *
 * This operator is a powerful way to convert any source that can be iterated
 * over (such as arrays, strings, `Map`, `Set`, `AsyncGenerator`, etc.) into
 * a reactive stream. The stream will emit each value from the source in order
 * before completing.
 *
 * @template T The type of the values in the iterable.
 * @param {AsyncIterable<T> | Iterable<T>} source The iterable source to convert into a stream.
 * @returns {Stream<T>} A new stream that emits each value from the source.
 */
export function from<T = any>(source: AsyncIterable<T> | Iterable<T>, context?: PipelineContext): Stream<T> {
  async function* generator() {
    for await (const value of source) {
      yield value;
    }
  }

  return createStream<T>("from", generator, context);
}
