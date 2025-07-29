import { createStream, Stream } from "../abstractions";
import { eachValueFrom } from "../converters";

export function race<T>(...streams: Stream<T>[]): Stream<T> {
  return createStream<T>('race', async function* () {
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
