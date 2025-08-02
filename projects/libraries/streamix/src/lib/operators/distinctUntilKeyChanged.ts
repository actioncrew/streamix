import { createOperator } from '../abstractions';

/**
 * Emits values from the source stream only if the specified key's value differs from the previous emitted value.
 * Uses an optional comparator function for custom equality check of the key's values; defaults to strict inequality.
 */
export const distinctUntilKeyChanged = <T extends object = any>(
  key: keyof T,
  comparator?: (prev: T[typeof key], curr: T[typeof key]) => boolean | Promise<boolean>
) =>
  createOperator<T, T>('distinctUntilKeyChanged', (source) => {
    let lastValue: T | undefined;
    let isFirst = true;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          const result = await source.next();
          if (result.done) return result;

          const current = result.value;

          const isDistinct = isFirst || (
            comparator
              ? !(await comparator(lastValue![key], current[key]))
              : lastValue![key] !== current[key]
          );

          isFirst = false;

          if (isDistinct) {
            lastValue = current;
            return { value: current, done: false };
          }
          // else skip this value and continue looping
        }
      }
    };
  });
