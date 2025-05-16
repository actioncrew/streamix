import { createOperator } from "../abstractions";

export const unique = <T, K = any>(keySelector?: (value: T) => K) =>
  createOperator("unique", (source) => {
    const seen = new Set<K | T>();

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          const { value, done } = await source.next();
          if (done) return { done: true, value: undefined };

          const key = keySelector ? keySelector(value) : value;

          if (!seen.has(key)) {
            seen.add(key);
            return { done: false, value };
          }
          // otherwise, continue to next item
        }
      }
    };
  });
