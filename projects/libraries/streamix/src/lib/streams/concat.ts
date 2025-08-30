import { createStream, PipelineContext, Stream } from "../abstractions";
import { eachValueFrom } from "../converters";

/**
 * Creates a stream that subscribes to multiple streams in sequence.
 *
 * This operator will subscribe to the first stream and yield all of its
 * values. Once the first stream completes, it will then subscribe to the
 * second stream, and so on, until all streams have completed. The resulting
 * stream will complete only after the last source stream has completed.
 *
 * If any of the source streams errors, the concatenated stream will also error and
 * stop processing the remaining streams.
 *
 * @template T The type of the values in the streams.
 * @param {Stream<T>[]} sources An array of streams to concatenate.
 * @returns {Stream<T>} A new stream that emits values from all input streams in sequence.
 */
export function concat<T = any>(sources: Stream<T>[], context?: PipelineContext): Stream<T> {
  async function* generator() {
    for (const source of sources) {

      const iterator = eachValueFrom(source);

      try {
        for await (const value of iterator) {
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

  return createStream<T>("concat", generator, context);
}
