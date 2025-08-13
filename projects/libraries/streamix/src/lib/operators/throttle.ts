import { createOperator, Operator } from '../abstractions';

/**
 * Emits the first value immediately, then ignores subsequent values for the specified duration (in ms).
 * After the duration passes, the next value is emitted and the cycle repeats.
 * @param duration The time in milliseconds to throttle for.
 */
export const throttle = <T = any>(duration: number): Operator<T, T> =>
  createOperator<T, T>('throttle', (source) => {
    let lastEmitTime = 0;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          const result = await source.next();
          if (result.done) {
            return result;
          }

          const now = Date.now();
          const timeSinceLastEmit = now - lastEmitTime;

          if (timeSinceLastEmit >= duration) {
            // Enough time has passed, emit this value
            lastEmitTime = now;
            return { value: result.value, done: false };
          } else {
            // Still in throttle period, wait for the remaining time
            const remainingTime = duration - timeSinceLastEmit;
            await new Promise(resolve => setTimeout(resolve, remainingTime));
            
            // After waiting, emit this value and update timestamp
            lastEmitTime = Date.now();
            return { value: result.value, done: false };
          }
        }
      }
    };
  });
