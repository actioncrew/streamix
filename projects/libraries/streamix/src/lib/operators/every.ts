import { createOperator } from '../abstractions';

export const every = <T = any>(
  predicate: (value: T, index: number) => boolean
) =>
  createOperator('every', async (source) => {
    let index = 0;

    while (true) {
      const result = await source.next();
      if (result.done) return { value: true, done: false }; // All passed
      if (!predicate(result.value, index++)) {
        return { value: false, done: false }; // One failed
      }
    }
  });
