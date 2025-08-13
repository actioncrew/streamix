import { createOperator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

/**
 * Emits the first value immediately, then ignores subsequent values
 * until the given duration has passed since the last emission.
 * @param duration The time in milliseconds to throttle for.
 */
export const throttle = <T = any>(duration: number) =>
  createOperator<T, T>('throttle', (source) => {
    const output = createSubject<T>();

    let lastEmitTime = 0;
    let sourceDone = false;

    (async () => {
      try {
        while (true) {
          const { value, done } = await source.next();
          if (done) break;

          const now = Date.now();
          if (now - lastEmitTime >= duration) {
            lastEmitTime = now;
            output.next(value);
          }
          // else: ignore the value
        }
      } catch (err) {
        output.error(err);
      } finally {
        sourceDone = true;
        output.complete();
      }
    })();

    const iterable = eachValueFrom<T>(output);
    return iterable[Symbol.asyncIterator]();
  });
