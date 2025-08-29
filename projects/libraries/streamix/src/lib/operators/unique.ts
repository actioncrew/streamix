import { createOperator, createStreamResult, DONE, NEXT, Operator } from "../abstractions";
import { CallbackReturnType } from './../abstractions/receiver';

/**
 * Creates a stream operator that emits only distinct values from the source stream.
 *
 * This operator maintains an internal set of values or keys that it has already emitted.
 * For each new value from the source, it checks if it has been seen before. If not,
 * the value is emitted and added to the set; otherwise, it is skipped.
 *
 * The uniqueness check can be based on the value itself or on a key derived from
 * the value using a provided `keySelector` function. This makes it ideal for de-duplicating
 * streams of primitive values or complex objects.
 *
 * @template T The type of the values in the source stream.
 * @template K The type of the key used for comparison.
 * @param keySelector An optional function to derive a unique key from each value.
 * If not provided, the values themselves are used for comparison.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const unique = <T = any, K = any>(
  keySelector?: (value: T) => CallbackReturnType<K>
) =>
  createOperator<T, T>("unique", function (this: Operator, source, context) {
    const seen = new Set<K | T>();

    return {
      next: async () => {
        while (true) {
          const result = createStreamResult(await source.next());

          if (result.done) return DONE;

          const key = keySelector ? await keySelector(result.value) : result.value;

          if (!seen.has(key)) {
            seen.add(key);
            return NEXT(result.value);
          }

          // duplicate → still emit as phantom
          await context?.markPhantom(this, result);
        }
      }
    };
  });
