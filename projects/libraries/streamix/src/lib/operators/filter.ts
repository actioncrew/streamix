import { createOperator } from '../abstractions';

export const filter = <T = any>(
  predicateOrValue: ((value: T, index: number) => boolean) | T | T[]
) =>
  createOperator('filter', (source) => {
    let index = 0;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          const result = await source.next();
          if (result.done) return result;

          const value = result.value;
          const shouldInclude =
            typeof predicateOrValue === 'function'
              ? predicateOrValue(value, index++)
              : Array.isArray(predicateOrValue)
              ? predicateOrValue.includes(value)
              : value === predicateOrValue;

          if (shouldInclude) return { value, done: false };
        }
      }
    };
  });
