import { createOperator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

/**
 * Emits the most recent value from the source stream at a fixed periodic interval.
 * If no new value arrives between intervals, the last emitted value is re-emitted.
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
          const { value, done } = await source.next();
          if (done) break;
          lastValue = value;
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
