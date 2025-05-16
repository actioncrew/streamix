import { createOperator } from '../abstractions';

export const max = <T = any>(
  comparator?: (a: T, b: T) => number
) => 
  createOperator('max', (source) => {
    let maxValue: T | undefined;
    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          const result = await source.next();
          if (result.done) {
            if (maxValue !== undefined) {
              // Return max value once source completes
              const value = maxValue;
              maxValue = undefined;
              return { value, done: false };
            }
            // No max, end iteration
            return { value: undefined as any, done: true };
          }
          const currentValue = result.value;
          if (
            maxValue === undefined ||
            (comparator ? comparator(currentValue, maxValue) > 0 : currentValue > maxValue)
          ) {
            maxValue = currentValue;
          }
        }
      },
    };
  });
