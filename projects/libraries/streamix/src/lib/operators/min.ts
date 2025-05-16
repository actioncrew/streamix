import { createOperator } from '../abstractions';

export const min = <T = any>(
  comparator?: (a: T, b: T) => number
) => 
  createOperator('min', (source) => {
    let minValue: T | undefined = undefined;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          const result = await source.next();

          if (result.done) {
            if (minValue !== undefined) {
              // Return the minValue once input is done, then complete next call
              const valueToReturn = minValue;
              minValue = undefined; // clear after emitting
              return { value: valueToReturn, done: false };
            }
            return { value: undefined, done: true };
          }

          const currentValue = result.value;

          if (
            minValue === undefined ||
            (comparator ? comparator(currentValue, minValue) < 0 : currentValue < minValue)
          ) {
            minValue = currentValue;
          }
        }
      }
    };
  });
