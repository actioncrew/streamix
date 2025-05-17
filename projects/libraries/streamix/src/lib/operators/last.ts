import { createOperator } from "../abstractions";

export const last = <T = any>(
  predicate?: (value: T) => boolean
) =>
  createOperator('last', (source) => {
    const iterator = source[Symbol.asyncIterator]?.() ?? source;
    let finished = false;
    let cached: T | undefined;
    let hasMatch = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        if (finished) return { done: true, value: undefined };

        try {
          for await (const value of iterator) {
            if (!predicate || predicate(value)) {
              cached = value;
              hasMatch = true;
            }
          }

          finished = true;

          if (hasMatch) {
            return { done: false, value: cached! };
          } else {
            throw new Error("No elements in sequence");
          }
        } catch (err) {
          finished = true;
          throw err;
        }
      },
    };
  });
