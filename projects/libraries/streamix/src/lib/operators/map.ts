import { createOperator } from '../abstractions';

export const map = <T = any, R = any>(
  transform: (value: T, index: number) => R
) =>
  createOperator('map', (source) => {
    let index = 0;
    return {
      async next(): Promise<IteratorResult<R>> {
        const result = await source.next();
        if (result.done) return result;
        return {
          value: transform(result.value, index++),
          done: false,
        };
      },
    };
  });
