import { CallbackReturnType, createOperator, createStreamResult, DONE, NEXT, Operator } from "../abstractions";

/**
 * Represents a grouped item with its original value and the associated key.
 * @template T The type of the original value.
 * @template K The type of the group key.
 */
export type GroupItem<T = any, K = any> = {
  value: T;
  key: K;
};

/**
 * Creates a stream operator that groups values from the source stream by a computed key.
 *
 * This operator is a projection operator that transforms a stream of values into a
 * stream of `GroupItem` objects. For each value from the source, it applies the
 * `keySelector` function to determine a key and then emits an object containing both
 * the original value and the computed key.
 *
 * This operator is the first step in a typical grouping pipeline. The resulting stream
 * of `GroupItem` objects can then be processed further by other operators (e.g., `scan`
 * or `reduce`) to perform a true grouping into collections.
 *
 * @template T The type of the values in the source stream.
 * @template K The type of the key computed by `keySelector`.
 * @param keySelector A function that takes a value from the source stream and returns
 * a key. This function can be synchronous or asynchronous.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const groupBy = <T = any, K = any>(
  keySelector: (value: T) => CallbackReturnType<K>
) =>
  createOperator<T, GroupItem<T, K>>("groupBy", function (this: Operator, source) {
    let completed = false;

    return {
      next: async () => {
        while (true) {
          if (completed) {
            return DONE;
          }

          const result = createStreamResult(await source.next());
          if (result.done) {
            completed = true;
            return DONE;
          }

          const key = await keySelector(result.value);
          return NEXT({ key, value: result.value });
        }
      }
    };
  });
