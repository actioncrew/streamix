import { createStream, PipelineContext, Stream } from '../abstractions';
import { eachValueFrom } from '../converters';

/**
 * Creates a stream that chooses between two streams based on a condition.
 *
 * The condition is evaluated lazily when the stream is subscribed to. This allows
 * for dynamic stream selection based on runtime state.
 *
 * @template T The type of the values in the streams.
 * @param {() => boolean} condition A function that returns a boolean to determine which stream to use. It is called when the iif stream is subscribed to.
 * @param {Stream<T>} trueStream The stream to subscribe to if the condition is `true`.
 * @param {Stream<T>} falseStream The stream to subscribe to if the condition is `false`.
 * @returns {Stream<T>} A new stream that emits values from either `trueStream` or `falseStream` based on the condition.
 */
export function iif<T = any>(
  condition: () => boolean,
  trueStream: Stream<T>,
  falseStream: Stream<T>,
  context?: PipelineContext
): Stream<T> {
  async function* generator(): AsyncGenerator<T, void, unknown> {
    // Evaluate condition lazily when the stream starts
    const sourceStream = condition() ? trueStream : falseStream;
    const asyncIterable = eachValueFrom<T>(sourceStream);
    const iterator = asyncIterable[Symbol.asyncIterator]();

    try {
      while (true) {
        const result = await iterator.next();
        if (result.done) break;
        yield result.value;
      }
    } finally {
      // Ensure proper cleanup of the iterator
      if (iterator.return) {
        try {
          await iterator.return(undefined);
        } catch {
          // Ignore any errors during cleanup
        }
      }
    }
  }

  return createStream<T>('iif', generator, context);
}
