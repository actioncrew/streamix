import { createStream, PipelineContext, Stream, StreamResult } from "../abstractions";
import { eachValueFrom } from "../converters";

/**
 * Merges multiple source streams into a single stream, emitting values as they arrive from any source.
 *
 * This is useful for combining data from multiple independent sources into a single,
 * unified stream of events. Unlike `zip`, it does not wait for a value from every
 * stream before emitting; it emits values on a first-come, first-served basis.
 *
 * The merged stream completes only after all source streams have completed. If any source stream
 * errors, the merged stream immediately errors.
 *
 * @template T The type of the values in the streams.
 * @param {Stream<T>[]} sources An array of streams to be merged.
 * @returns {Stream<T>} A new stream that emits values from all input streams.
 */
export function merge<T = any>(sources: Stream<T>[], context?: PipelineContext): Stream<T> {
  return createStream<T>('merge', async function* () {
    if (sources.length === 0) return;

    const iterators = sources.map(s => eachValueFrom(s)[Symbol.asyncIterator]());
    const nextPromises: Array<Promise<StreamResult> | null> = iterators.map(it => it.next());
    let activeCount = iterators.length;

    const reflect = (promise: Promise<StreamResult>, index: number) =>
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
  }, context);
}
