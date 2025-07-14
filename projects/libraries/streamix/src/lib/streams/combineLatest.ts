import { createStream, Stream } from "../abstractions";
import { eachValueFrom } from "../converters";

// Combine multiple streams and emit the latest value from each stream
export function combineLatest<T = any>(streams: Stream<T>[]): Stream<T[]> {
  return createStream(
    "combineLatest",
    async function* () {
      if (streams.length === 0) {
        return;
      }

      const latestValues: T[] = Array(streams.length).fill(undefined);
      const hasEmitted = Array(streams.length).fill(false);
      let completedStreams = 0;

      // Convert each stream to async iterable
      const asyncIterables = streams.map(stream => eachValueFrom(stream));
      const iterators = asyncIterables.map(iterable => iterable[Symbol.asyncIterator]());

      // Create promises for each stream's next value
      const createPromise = (index: number) => {
        return iterators[index].next().then(result => ({
          index,
          value: result.value,
          done: result.done
        }));
      };

      // Initialize promises for all streams
      let promises = streams.map((_, index) => createPromise(index));

      while (completedStreams < streams.length) {
        try {
          // Wait for the first stream to emit
          const result = await Promise.race(promises);

          if (result.done) {
            completedStreams++;
            // Remove the completed stream's promise
            promises = promises.filter((_, i) => i !== result.index);
            continue;
          }

          // Update the latest value for this stream
          latestValues[result.index] = result.value;
          hasEmitted[result.index] = true;

          // Emit combined values only when all streams have emitted at least once
          if (hasEmitted.every(Boolean)) {
            yield [...latestValues];
          }

          // Replace the resolved promise with a new one for the same stream
          promises.findIndex(p => p === promises.find(p => p.then));
          promises[result.index] = createPromise(result.index);

        } catch (error) {
          // If any stream errors, the combined stream should error
          throw error;
        }
      }
    }
  );
}
