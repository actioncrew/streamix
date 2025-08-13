import { createOperator, Operator } from '../abstractions';

/**
 * Emits the first value immediately, then ignores subsequent values for the specified duration (in ms).
 * After the duration passes, the next value is emitted and the cycle repeats.
 * @param duration The time in milliseconds to throttle for.
 */
export const throttle = <T = any>(duration: number): Operator<T, T> =>
  createOperator<T, T>('throttle', (source) => {
    let lastEmitTime = 0;
    let sourceDone = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        if (sourceDone) {
          return { done: true, value: undefined };
        }

        while (true) {
          const result = await source.next();
          
          if (result.done) {
            sourceDone = true;
            return result;
          }

          const now = Date.now();
          if (now - lastEmitTime >= duration) {
            lastEmitTime = now;
            return result;
          }
          // Continue to next iteration, ignoring this value
        }
      },
      async return(value?: any) {
        sourceDone = true;
        return source.return?.(value) ?? { value, done: true };
      },
      async throw(error: any) {
        sourceDone = true;
        return source.throw?.(error) ?? Promise.reject(error);
      }
    };
  });
