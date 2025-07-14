import { Stream, createStream } from '../abstractions';
import { eachValueFrom } from '../converters';

/**
 * Combines multiple streams by emitting an array of latest values,
 * but only emits when all streams have emitted at least once.
 *
 * After emitting, it waits for the next batch of values from all streams again.
 *
 * Completes when any stream completes.
 * Errors propagate immediately.
 */
export function zip(streams: Stream<any>[]): Stream<any[]> {
  return createStream<any[]>('zip', async function* () {
    if (streams.length === 0) {
      return;
    }

    // Create async iterators for all streams
    const iterators = streams.map(s => eachValueFrom(s)[Symbol.asyncIterator]());

    // Buffer for each stream's latest value
    let latestValues: (any | undefined)[] = Array(streams.length).fill(undefined);
    // Flags to track if stream has emitted for current "round"
    let hasValue: boolean[] = Array(streams.length).fill(false);

    // Track completion
    let done = false;

    // Helper: get next value for a specific iterator, catching error/completion
    async function getNext(i: number): Promise<IteratorResult<any, any>> {
      try {
        return await iterators[i].next();
      } catch (err) {
        done = true;
        throw err;
      }
    }

    while (!done) {
      // For each iterator that does not have value yet for this round, request next
      for (let i = 0; i < iterators.length; i++) {
        if (!hasValue[i]) {
          const { done: d, value } = await getNext(i);
          if (d) {
            done = true;
            break;
          }
          latestValues[i] = value;
          hasValue[i] = true;
        }
      }

      if (done) break;

      // Once all have emitted, yield the combined array and reset flags
      if (hasValue.every(Boolean)) {
        yield [...latestValues] as any[];
        hasValue.fill(false);
        latestValues.fill(undefined);
      }
    }

    // Cleanup iterators if they have return()
    await Promise.all(
      iterators.map(it => (it.return ? it.return(undefined) : Promise.resolve()))
    );
  });
}
