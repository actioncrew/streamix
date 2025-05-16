import { createOperator } from '../abstractions';

export const distinctUntilChanged = <T = any>(
  comparator?: (previous: T, current: T) => boolean
) =>
  createOperator('distinctUntilChanged', (source) => {
    let lastValue: T | undefined;
    let isFirst = true;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          const result = await source.next();
          if (result.done) return result;

          const currentValue = result.value;
          const isDistinct = isFirst || (
            comparator
              ? !comparator(lastValue!, currentValue)
              : lastValue !== currentValue
          );

          if (isDistinct) {
            lastValue = currentValue;
            isFirst = false;
            return { value: currentValue, done: false };
          }
        }
      }
    };
  });
