import { createOperator, Operator } from '../abstractions';

/**
 * Emits the first value immediately, then ignores subsequent values for the specified duration (in ms).
 * After the duration passes, the next value is emitted and the cycle repeats.
 */
export const throttle = <T = any>(duration: number): Operator<T, T> =>
  createOperator<T, T>('throttle', (source) => {
    let lastEmitTime = 0;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          const result = await source.next();
          if (result.done) return result;

          const now = Date.now();
          if (now - lastEmitTime >= duration) {
            lastEmitTime = now;
            return { value: result.value, done: false };
          }
          // else skip and keep looping
        }
      }
    };
  });
