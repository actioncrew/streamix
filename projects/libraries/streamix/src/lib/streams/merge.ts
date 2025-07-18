import { createStream, createSubscription, Receiver, Stream, Subscription } from "../abstractions";
import { eachValueFrom } from "../converters";

/**
 * Merges multiple source streams into a single stream, emitting values as they arrive from any source.
 * The merged stream completes only after all source streams have completed. If any source stream
 * errors, the merged stream immediately errors.
 * Supports cancellation via AbortController.
 */
export function merge<T = any>(...sources: Stream<T>[]): Stream<T> {
  const controller = new AbortController();
  const signal = controller.signal;

  const stream = createStream<T>('merge', async function* () {
    if (sources.length === 0) return;

    const iterators = sources.map(s => eachValueFrom(s)[Symbol.asyncIterator]());
    const nextPromises: Array<Promise<IteratorResult<T>> | null> = iterators.map(it => it.next());
    let activeCount = iterators.length;

    const reflect = (promise: Promise<IteratorResult<T>>, index: number) =>
      promise.then(
        result => ({ ...result, index, status: 'fulfilled' as const }),
        error => ({ error, index, status: 'rejected' as const })
      );

    while (activeCount > 0 && !signal.aborted) {
      const race = Promise.race(
        nextPromises
          .map((p, i) => (p ? reflect(p, i) : null))
          .filter(Boolean) as Promise<
            | { index: number; value: T; done: boolean; status: 'fulfilled' }
            | { index: number; error: any; status: 'rejected' }
          >[]
      );

      const winner = await Promise.race([
        race,
        new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('merge aborted')));
        }),
      ]);

      if (signal.aborted) break;

      if (winner.status === 'rejected') {
        throw winner.error;
      }

      const { value, done, index } = winner;

      if (done) {
        nextPromises[index] = null;
        activeCount--;
      } else {
        yield value;
        nextPromises[index] = iterators[index].next();
      }
    }

    // Cleanup all iterators on abort or completion
    for (const iterator of iterators) {
      if (iterator.return) {
        try {
          await iterator.return(undefined);
        } catch {
          // ignore
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
