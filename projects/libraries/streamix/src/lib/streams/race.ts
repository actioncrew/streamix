import { Stream, createStream } from "../abstractions";
import { eachValueFrom } from "../converters"; // Assuming this converter exists

/**
 * Returns a Stream that mirrors the first source Stream to emit a value, error, or completion.
 * Once a stream wins the race, all other source streams are unsubscribed.
 */
export function race<T>(...streams: Stream<T>[]): Stream<T> {
  return createStream<T>('race', async function* () {
    // If no streams are provided, the resulting stream completes immediately.
    if (streams.length === 0) {
      return;
    }

    // Convert all streams to async iterators for manual control.
    const iterators = streams.map(s => eachValueFrom(s)[Symbol.asyncIterator]());

    try {
      /**
       * A helper to wrap a promise. This lets us know which promise won the race
       * and prevents an early error from crashing Promise.race.
       */
      const reflect = (promise: Promise<IteratorResult<T>>, index: number) =>
        promise.then(
          result => ({ ...result, index, status: 'fulfilled' as const }),
          error => ({ error, index, status: 'rejected' as const })
        );

      // 1. Create the race by asking for the next value from every iterator.
      const racePromises = iterators.map((it, i) => reflect(it.next(), i));
      const winner = await Promise.race(racePromises);

      // 2. Handle the winner.
      if (winner.status === 'rejected') {
        // The first stream to emit, errored. Propagate the error.
        throw winner.error;
      }

      const { value, done, index } = winner;
      const winningIterator = iterators[index];

      if (done) {
        // The winning stream completed without emitting a value. So we complete.
        return;
      }

      // 3. Yield the first value from the winning stream.
      yield value;

      // 4. Now, exclusively follow the winning iterator until it's done.
      let nextResult = await winningIterator.next();
      while (!nextResult.done) {
        yield nextResult.value;
        nextResult = await winningIterator.next();
      }

    } finally {
      // 5. Cleanup: Ensure all iterators are closed to prevent leaks.
      // This is the equivalent of unsubscribing.
      for (const iterator of iterators) {
        if (typeof iterator.return === 'function') {
          // Tell the underlying source to stop producing values.
          iterator.return(undefined);
        }
      }
    }
  });
}
