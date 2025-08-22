import { createOperator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

/**
 * Creates a stream operator that emits the most recent value from the source stream
 * at a fixed periodic interval.
 *
 * This operator controls the rate of emissions. It maintains a buffer for the latest
 * value received from the source stream. It then uses an internal timer to periodically
 * emit that latest value to the output stream at a rate defined by the `period`.
 * If the source stream is faster than the `period`, multiple values will be skipped.
 * If the source is slower, the same value will be re-emitted.
 *
 * This is useful for:
 * - Sampling live data streams (e.g., sensor readings) for display on a UI.
 * - Limiting the frequency of expensive operations triggered by a fast event source.
 *
 * @template T The type of the values in the source and output streams.
 * @param period The time in milliseconds between each emission.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const sample = <T = any>(period: number) =>
  createOperator<T, T>('sample', (source) => {
    const output = createSubject<T>();

    let lastValue: T | undefined;
    let intervalId: any;

    // Starts a timer that periodically emits the last seen value
    const startSampling = () => {
      intervalId = setInterval(() => {
        if (lastValue !== undefined) {
          output.next(lastValue);
        }
      }, period);
    };

    const stopSampling = () => {
      if (intervalId != null) {
        clearInterval(intervalId);
      }
    };

    (async () => {
      try {
        startSampling();

        while (true) {
          const result = await source.next();
          if (result.done) break;
          if (result.phantom) continue;
          lastValue = result.value;
        }

        // Emit the final value after source completes
        if (lastValue !== undefined) {
          output.next(lastValue);
        }
      } catch (err) {
        output.error(err);
      } finally {
        output.complete();
        stopSampling();
      }
    })();

    const iterable = eachValueFrom<T>(output);
    return iterable[Symbol.asyncIterator]();
  });
