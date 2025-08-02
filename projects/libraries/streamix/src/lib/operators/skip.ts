import { createOperator } from '../abstractions';

/**
 * Skips the first specified number of values from the source stream.
 */
export const skip = <T = any>(count: number) =>
  createOperator<T, T>('skip', (source) => {
    let counter = count;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          const { done, value } = await source.next();
          if (done) {
            return { done: true, value: undefined };
          }

          if (counter > 0) {
            counter--;
            continue; // Skip this value
          }

          return { done: false, value };
        }
      },
    };
  });
