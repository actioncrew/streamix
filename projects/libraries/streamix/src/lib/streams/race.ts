import { createStream, createSubscription, Receiver, Stream, Subscription } from "../abstractions";
import { eachValueFrom } from "../converters";

/**
 * Returns a Stream that mirrors the first source Stream to emit a value, error, or completion.
 * Once a stream wins the race, all other source streams are unsubscribed.
 * Supports cancellation via AbortController.
 */
export function race<T>(...streams: Stream<T>[]): Stream<T> {
  const controller = new AbortController();
  const signal = controller.signal;

  const stream = createStream<T>('race', async function* () {
    if (streams.length === 0) {
      return;
    }

    const iterators = streams.map(s => eachValueFrom(s)[Symbol.asyncIterator]());

    try {
      const reflect = (promise: Promise<IteratorResult<T>>, index: number) =>
        promise.then(
          result => ({ ...result, index, status: 'fulfilled' as const }),
          error => ({ error, index, status: 'rejected' as const })
        );

      // Create the race by requesting next value from every iterator
      const racePromises = iterators.map((it, i) => reflect(it.next(), i));
      const winner = await Promise.race([
        Promise.race(racePromises),
        new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('race aborted')));
        }),
      ]);

      if (signal.aborted) return;

      if (winner.status === 'rejected') {
        throw winner.error;
      }

      const { value, done, index } = winner;
      const winningIterator = iterators[index];

      if (done) {
        return;
      }

      yield value;

      // Now exclusively follow the winning iterator until completion or abort
      let nextResult = await winningIterator.next();
      while (!nextResult.done && !signal.aborted) {
        yield nextResult.value;
        nextResult = await winningIterator.next();
      }
    } finally {
      // Cleanup all iterators (unsubscribe)
      for (const iterator of iterators) {
        if (iterator.return) {
          try {
            await iterator.return(undefined);
          } catch {
            // ignore
          }
        }
      }
    }
  });

  const originalSubscribe = stream.subscribe;
  stream.subscribe = (
    callbackOrReceiver?: ((value: T) => void) | Receiver<T>
  ): Subscription => {
    const subscription = originalSubscribe.call(stream, callbackOrReceiver);

    return createSubscription(() => {
      controller.abort();
      subscription.unsubscribe();
    });
  };

  return stream;
}
