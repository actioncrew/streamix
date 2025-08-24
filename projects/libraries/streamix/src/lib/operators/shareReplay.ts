import { createOperator, createStreamResult, Operator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createReplaySubject, ReplaySubject } from '../streams';

/**
 * Creates a stream operator that shares a single subscription to the source stream
 * and replays a specified number of past values to new subscribers.
 *
 * This operator multicasts the source stream, ensuring that multiple downstream
 * consumers can receive values from a single source connection. It uses an internal
 * `ReplaySubject` to cache the most recent values. When a new consumer subscribes,
 * it immediately receives these cached values before receiving new ones.
 *
 * This is useful for:
 * - Preventing redundant execution of a source stream (e.g., a network request).
 * - Providing a "state history" to late subscribers.
 *
 * @template T The type of the values in the stream.
 * @param bufferSize The number of last values to replay to new subscribers. Defaults to `Infinity`.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export function shareReplay<T = any>(bufferSize: number = Infinity) {
  let isConnected = false;
  let output: ReplaySubject<T> | undefined;

  return createOperator<T, T>('shareReplay', function (this: Operator, source) {
    if (!output) {
      output = createReplaySubject<T>(bufferSize);
    }

    if (!isConnected) {
      isConnected = true;

      (async () => {
        try {
          while (true) {
            let result = createStreamResult(await source.next());
            if (result.done) break;

            output.next(result.value);
            result = createStreamResult(await source.next());
          }
        } catch (err) {
          output.error(err);
        } finally {
          output.complete();
        }
      })();
    }

    const iterable = eachValueFrom<T>(output);
    return iterable[Symbol.asyncIterator]();
  });
}
