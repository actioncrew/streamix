import { createOperator } from "../abstractions";
import { eachValueFrom } from '../converters';
import { createSubject, timer } from "../streams";

/**
 * Creates a stream operator that buffers values from the source stream and emits
 * them as arrays every `period` milliseconds.
 *
 * This operator collects all values that arrive within a specified time window.
 * It uses an internal timer that fires periodically to "flush" the collected
 * values, emitting them as a single array before starting a new collection.
 *
 * - **Periodic Emission:** The operator's output stream emits arrays of buffered
 * values at a fixed interval determined by `period`.
 * - **Completion:** When the source stream completes, the operator will perform
 * one final flush of any remaining values in the buffer before completing its own output stream.
 * - **Error Handling:** Any error from either the source stream or the internal
 * timer will immediately cause the output stream to error and terminate.
 *
 * This is useful for batching asynchronous events or data to reduce processing
 * overhead or network requests.
 *
 * @template T The type of the values in the source stream.
 * @param period The time in milliseconds to wait between each buffer emission.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export function buffer<T = any>(period: number) {
  return createOperator<T, T[]>('buffer', (source) => {
    const output = createSubject<T[]>();
    let buffer: T[] = [];
    let completed = false;

    const flush = () => {
      if (buffer.length > 0) {
        output.next([...buffer]);
        buffer = [];
      }
    };

    const cleanup = () => {
      intervalSubscription.unsubscribe();
    };

    const flushAndComplete = () => {
      flush();
      if (!completed) {
        completed = true;
        output.complete();
      }
      cleanup();
    };

    const intervalSubscription = timer(period, period).subscribe({
      next: () => flush(),
      error: (err) => {
        output.error(err);
        cleanup();
      },
      complete: () => flushAndComplete(),
    });

    (async () => {
      try {
        while (true) {
          const result = await source.next();
          if (result.done) break;
          if (result.phantom) continue;

          buffer.push(result.value);
          output.phantom(result.value);
        }
      } catch (err) {
        cleanup();
        output.error(err);
      } finally {
        flushAndComplete();
      }
    })();

    const iterable = eachValueFrom<T[]>(output);
    return iterable[Symbol.asyncIterator]();
  });
}
