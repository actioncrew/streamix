import { createOperator } from '../abstractions';

export const distinctUntilChanged = <T = any>(
  comparator?: (previous: T, current: T) => boolean
) =>
  createOperator('distinctUntilChanged', (source) => {
    let last: T | undefined;
    let isFirst = true;

    return {
      next: async (): Promise<IteratorResult<T>> => {
        const result = await source.next();
        if (result.done) return result;

        const current = result.value;
        const isDistinct = isFirst || (
          comparator ? !comparator(last!, current) : last !== current
        );

        isFirst = false;
        if (isDistinct) {
          last = current;
          return { value: current, done: false };
        }

        return { value: undefined as any, done: false }; // downstream should skip undefined
      }
    };
  });
