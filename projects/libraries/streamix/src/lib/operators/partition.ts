import { CallbackReturnType, createOperator } from "../abstractions";
import { GroupItem } from "./groupBy";

/**
 * Splits the source stream into two groups based on a predicate.
 * Emits items wrapped in an object containing the key `"true"` or `"false"`,
 * indicating whether each item satisfies the predicate.
 */
export const partition = <T = any>(
  predicate: (value: T, index: number) => CallbackReturnType<boolean>
) =>
  createOperator<T, GroupItem<T, "true" | "false">>('partition', (source) => {
    let index = 0;

    return {
      async next(): Promise<IteratorResult<GroupItem<T, "true" | "false">>> {
        const result = await source.next();
        if (result.done) {
          return { value: undefined, done: true };
        }
        const key = await predicate(result.value, index++) ? "true" : "false";
        return { value: { key, value: result.value }, done: false };
      }
    };
  });
