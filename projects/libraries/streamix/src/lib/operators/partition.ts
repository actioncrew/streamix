import { CallbackReturnType, createOperator } from "../abstractions";
import { StreamResult } from './../abstractions/stream';
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
  createOperator<T, GroupItem<T, "true" | "false">>('partition', (source) => {
    let index = 0;
    let completed = false;

    return {
      async next(): Promise<StreamResult<GroupItem<T, "true" | "false">>> {
        while (true) {
          if (completed) {
            return { value: undefined, done: true };
          }

          const result = await source.next();
          if (result.done) {
            completed = true;
            return { value: undefined, done: true };
          }

          const key = await predicate(result.value, index++) ? "true" : "false";
          return { value: { key, value: result.value }, done: false };
        }
      }
    };
  });
