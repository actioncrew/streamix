import { createOperator } from '../abstractions';
import { CallbackReturnType } from './../abstractions/receiver';

export const filter = <T = any>(
  predicateOrValue: ((value: T, index: number) => CallbackReturnType<boolean>) | T | T[]
) =>
  createOperator<T, T>('filter', (source) => {
    let index = 0;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          const result = await source.next();
          if (result.done) return result;

          const value = result.value;
          let shouldInclude = false;

          if (typeof predicateOrValue === 'function') {
            shouldInclude = await (predicateOrValue as (value: T, index: number) => CallbackReturnType<boolean>)(value, index);
          } else if (Array.isArray(predicateOrValue)) {
            shouldInclude = predicateOrValue.includes(value);
          } else {
            shouldInclude = value === predicateOrValue;
          }

          if (shouldInclude) {
            index++; // Increment index only if included
            return { value, done: false };
          }
        }
      }
    };
  });
