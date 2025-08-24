import { CallbackReturnType, createOperator, createStreamResult, DONE, NEXT, Operator } from "../abstractions";
import { GroupItem } from "./groupBy";

/**
 * Creates a stream operator that partitions the source stream into two groups based on a predicate.
 *
 * This operator is a specialized form of `groupBy`. For each value from the source stream,
 * it applies the provided `predicate` function. It then emits a new object, a `GroupItem`,
 * containing the original value and a key of `"true"` or `"false"`, indicating whether the
 * value satisfied the predicate.
 *
 * This operator does not create two physical streams, but rather tags each item with its
 * group membership, allowing for subsequent conditional routing or processing.
 *
 * @template T The type of the values in the source stream.
 * @param predicate A function that takes a value and its index and returns a boolean or
 * `Promise<boolean>`. `true` for one group, `false` for the other.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method,
 * emitting objects of type `GroupItem<T, "true" | "false">`.
 */
export const partition = <T = any>(
  predicate: (value: T, index: number) => CallbackReturnType<boolean>
) =>
  createOperator<T, GroupItem<T, "true" | "false">>('partition', function (this: Operator, source) {
    let index = 0;
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

          const key = await predicate(result.value, index++) ? "true" : "false";
          return NEXT({ key, value: result.value } as GroupItem<T, "true" | "false">);
        }
      }
    };
  });
