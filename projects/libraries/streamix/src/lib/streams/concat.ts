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

  return createStream<T>("concat", generator);
}
