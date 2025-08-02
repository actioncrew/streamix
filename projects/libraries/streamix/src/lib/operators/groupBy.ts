import { CallbackReturnType, createOperator } from "../abstractions";

/**
 * Represents a grouped item with its original value and the associated key.
 */
export type GroupItem<T = any, K = any> = {
  value: T;
  key: K;
};

/**
 * Creates an operator that groups values by a computed key.
 *
 * Emits objects containing the original value and its corresponding key.
 */
export const groupBy = <T = any, K = any>(
  keySelector: (value: T) => CallbackReturnType<K>
) =>
  createOperator<T, GroupItem<T, K>>("groupBy", (source) => ({
    async next(): Promise<IteratorResult<GroupItem<T, K>>> {
      const result = await source.next();
      if (result.done) return result;

      const key = await keySelector(result.value);
      return { value: { key, value: result.value }, done: false };
    }
  }));
