import { createStream, Stream } from "../abstractions";
import { eachValueFrom } from "../converters";

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
