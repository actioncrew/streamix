import { createStream, Stream } from "../abstractions";
import { eachValueFrom } from "../converters";

/**
 * Returns a stream that races multiple input streams.
 * It emits values from the first stream that produces a value,
 * then cancels all other streams.
 *
 * Once the winning stream completes, the output stream completes.
 */
export function race<T extends readonly unknown[] = any[]>(
  ...streams: { [K in keyof T]: Stream<T[K]> }
): Stream<T[number]> {
  return createStream<T[number]>('race', async function* () {
    if (streams.length === 0) return;

    const controllers = streams.map(() => new AbortController());
    const iterators = streams.map((s) => eachValueFrom(s)[Symbol.asyncIterator]());

    try {
      while (true) {
        // Create promises for all iterators
        const promises = iterators.map((it, i) =>
          it.next().then(result => ({ ...result, index: i }))
        );

        // Race all iterators
        const { value, done, index } = await Promise.race(promises);

        if (done) {
          // Cancel all other streams
          controllers.forEach((c, i) => i !== index && c.abort());
          return;
        }

        yield value;

        // Cancel losing streams
        controllers.forEach((c, i) => i !== index && c.abort());
      }
    } finally {
      // Cleanup all controllers
      controllers.forEach(c => c.abort());
    }
  });
}
