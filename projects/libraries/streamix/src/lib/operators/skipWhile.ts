import { createOperator } from '../abstractions';

export const skipWhile = <T = any>(predicate: (value: T) => boolean) =>
  createOperator('skipWhile', (source) => {
    let skipping = true;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          const { value, done } = await source.next();

          if (done) {
            return { value: undefined, done: true };
          }

          if (skipping) {
            if (!predicate(value)) {
              skipping = false;
              return { value, done: false };
            }
            // If still skipping, continue looping
          } else {
            return { value, done: false };
          }
        }
      }
    };
  });
