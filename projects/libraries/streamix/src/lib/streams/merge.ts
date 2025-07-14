import { createStream, Stream } from "../abstractions";
import { eachValueFrom } from "../converters";

/**
 * Merges multiple source streams into a single stream, emitting values as they arrive from any source.
 * The merged stream completes only after all source streams have completed. If any source stream
 * errors, the merged stream immediately errors.
 *
 * @param sources A list of streams to merge.
 * @returns A new stream that emits values from all source streams.
 */
export function merge<T = any>(...sources: Stream<T>[]): Stream<T> {
  return createStream<T>('merge', async function* () {
    if (sources.length === 0) return;

    const iterators = sources.map(s => eachValueFrom(s)[Symbol.asyncIterator]());
    const nextPromises: Array<Promise<IteratorResult<T>> | null> = iterators.map(it => it.next());
    let activeCount = iterators.length;

    const reflect = (promise: Promise<IteratorResult<T>>, index: number) =>
      promise.then(
        result => ({ ...result, index, status: 'fulfilled' as const }),
        error => ({ error, index, status: 'rejected' as const })
      );

    while (activeCount > 0) {
      const race = Promise.race(
        nextPromises
          .map((p, i) => (p ? reflect(p, i) : null))
          .filter(Boolean) as Promise<
            | { index: number; value: T; done: boolean; status: 'fulfilled' }
            | { index: number; error: any; status: 'rejected' }
          >[]
      );

      const winner = await race;

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
  });
}
