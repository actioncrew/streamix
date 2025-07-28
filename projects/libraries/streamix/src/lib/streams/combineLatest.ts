import { createStream, Stream } from "../abstractions";
import { eachValueFrom } from "../converters";

/**
 * Combines multiple streams and emits an array containing the latest values
 * from each stream whenever any stream emits a new value.
 */
export function combineLatest<T = any>(streams: Stream<T>[]): Stream<T[]> {
  const controller = new AbortController();
  const signal = controller.signal;

  async function* generator() {
    if (streams.length === 0) {
      return;
    }

    const latestValues: T[] = Array(streams.length).fill(undefined);
    const hasEmitted = Array(streams.length).fill(false);
    let completedStreams = 0;

    // Convert each stream to async iterable
    const asyncIterables = streams.map((stream) => eachValueFrom(stream));
    const iterators = asyncIterables.map((iterable) => iterable[Symbol.asyncIterator]());

    // Track active promises for cleanup
    const activePromises = new Set<Promise<any>>();

    // Create promises for each stream's next value
    const createPromise = (index: number) => {
      const promise = iterators[index]
        .next()
        .then((result) => ({
          index,
          value: result.value,
          done: result.done,
        }));
      activePromises.add(promise);
      return promise;
    };

    // Initialize promises for all streams
    let promises = streams.map((_, index) => createPromise(index));

    try {
      while (completedStreams < streams.length && !signal.aborted) {
        // Wait for the first stream to emit
        const result = await Promise.race(promises);

        // Remove completed promise from active set
        activePromises.delete(promises[result.index]);

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
        promises[result.index] = createPromise(result.index);
      }
    } finally {
      // Cleanup: Cancel all active iterators
      for (const iterator of iterators) {
        if (iterator.return) {
          try {
            await iterator.return(undefined);
          } catch {
            // Ignore cleanup errors
          }
        }
      }

      activePromises.clear();
    }
  }

  return createStream<T[]>("combineLatest", generator);
}
