import { createOperator } from "../abstractions";
import { CallbackReturnType } from './../abstractions/receiver';

/**
 * Emits only distinct values, comparing by the key selector or by value if no selector is provided.
 * Duplicate keys/values are skipped.
 */
export const unique = <T = any, K = any>(
  keySelector?: (value: T) => CallbackReturnType<K>
) =>
  createOperator<T, T>("unique", (source) => {
    const seen = new Set<K | T>();

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          const { value, done } = await source.next();
          if (done) return { done: true, value: undefined };

          const key = keySelector ? await keySelector(value) : value;

          if (!seen.has(key)) {
            seen.add(key);
            return { done: false, value };
          }
          // skip duplicate
        }
      }
    };
  });
