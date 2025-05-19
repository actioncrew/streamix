import { createOperator } from '../abstractions';

export const min = <T = any>(
  comparator?: (a: T, b: T) => number
) =>
  createOperator('min', (source) => {
    let minValue: T | undefined;
    let hasEmitted = false;

    async function next(): Promise<IteratorResult<T>> {
      while (true) {
        const result = await source.next();
        if (result.done) {
          if (hasEmitted) {
            return { value: minValue, done: true };
          } else {
            return { value: undefined, done: true };
          }
        }

        const currentValue = result.value;

        if (!hasEmitted) {
          minValue = currentValue;
          hasEmitted = true;
        } else if (minValue !== undefined) {
          if (comparator) {
            if (comparator(currentValue, minValue) < 0) {
              minValue = currentValue;
            }
          } else if (minValue !== null && currentValue < minValue) {
            minValue = currentValue;
          }
        }
      }
    }

    return { next };
  });
