import { createOperator, Operator } from '../abstractions';

/**
 * Emits the first value immediately, then ignores subsequent values for the specified duration (in ms).
 * After the duration passes, the next value is emitted and the cycle repeats.
 * @param duration The time in milliseconds to throttle for.
 */
export const throttle = <T = any>(duration: number): Operator<T, T> =>
  createOperator<T, T>('throttle', (source) => {
    let lastEmitTime = 0;
    let throttling = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          const result = await source.next();
          if (result.done) {
            // Ensure we don't return done while a throttle is active
            if (throttling) {
              // Wait for the throttling period to end before propagating completion
              await new Promise(resolve => setTimeout(resolve, duration - (Date.now() - lastEmitTime)));
            }
            return result;
          }

          if (!throttling) {
            // If not currently throttling, emit the value and start the throttle period
            throttling = true;
            lastEmitTime = Date.now();
            setTimeout(() => {
              throttling = false;
            }, duration);
            return { value: result.value, done: false };
          }
          // If throttling, the value is simply ignored, and the loop continues
        }
      }
    };
  });
