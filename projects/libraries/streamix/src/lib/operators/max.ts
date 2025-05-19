import { createOperator } from '../abstractions';

export const max = <T = any>(
  comparator?: (a: T, b: T) => number
) =>
  createOperator('max', (source) => {
    let maxValue: T | undefined;
    let hasEmitted = false;

    async function next(): Promise<IteratorResult<T>> {
      while (true) {
        const result = await source.next();
        if (result.done) {
          if (hasEmitted) {
            return { value: maxValue, done: true }; // Return maxValue (can be undefined if source had no comparable elements)
          } else {
            return { value: undefined, done: true }; // No values in source
          }
        }

        const currentValue = result.value;
        if (!hasEmitted) {
          maxValue = currentValue;
          hasEmitted = true;
        } else if (maxValue !== undefined) { // Ensure maxValue has a value before comparing
          if (comparator) {
            if (comparator(currentValue, maxValue) > 0) {
              maxValue = currentValue;
            }
          } else if (maxValue !== null && currentValue > maxValue) {
            maxValue = currentValue;
          }
        }
      }
    }

    return { next };
  });
