import { createStream, Stream } from "../abstractions";
import { eachValueFrom } from "../converters";

/**
 * Concatenates multiple streams by subscribing to each one sequentially.
 *
 * - Emits all values from the first stream, then moves to the next.
 * - Completes when all source streams have completed.
 * - Propagates errors from any source stream immediately.
 */
export function concat<T = any>(...sources: Stream<T>[]): Stream<T> {
  return createStream('concat', async function* () {
    for (const source of sources) {
      // Use eachValueFrom to properly handle the stream
      const iterator = eachValueFrom(source);

      try {
        for await (const value of iterator) {
          yield value;
        }
      } catch (error) {
        // Propagate any errors from the source
        throw error;
      }
    }
  });
}
