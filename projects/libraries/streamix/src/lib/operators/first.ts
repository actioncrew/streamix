import { createOperator } from "../abstractions";

export const first = <T = any>(predicate?: (value: T) => boolean) =>
  createOperator<T, T>('first', (source) => {
    const iterator = source[Symbol.asyncIterator]?.() ?? source;
    let done = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        if (done) return { value: undefined, done: true };

        try {
          for await (const value of iterator) {
            if (!predicate || predicate(value)) {
              done = true;
              return { value, done: false };
            }
          }

          done = true;
          throw new Error("No elements in sequence");
        } catch (err) {
          done = true;
          throw err;
        }
      }
    };
  });
