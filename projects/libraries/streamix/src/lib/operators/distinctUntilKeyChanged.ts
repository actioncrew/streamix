import { createOperator } from '../abstractions';

export const distinctUntilKeyChanged = <T extends object>(
  key: keyof T,
  comparator?: (prev: T[typeof key], curr: T[typeof key]) => boolean
) =>
  createOperator('distinctUntilKeyChanged', (source) => {
    let lastValue: T | undefined;
    let isFirst = true;

    return {
      next: async (): Promise<IteratorResult<T>> => {
        const result = await source.next();
        if (result.done) return result;

        const current = result.value;
        const isDistinct = isFirst || (
          comparator
            ? !comparator(lastValue![key], current[key])
            : lastValue![key] !== current[key]
        );

        isFirst = false;
        if (isDistinct) {
          lastValue = current;
          return { value: current, done: false };
        }

        return { value: undefined as any, done: false }; // downstream should skip undefined
      }
    };
  });
