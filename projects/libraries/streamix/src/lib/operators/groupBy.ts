import { CallbackReturnType, createOperator } from "../abstractions";

export type GroupItem<T = any, K = any> = {
  value: T;
  key: K;
};

export const groupBy = <T = any, K = any>(
  keySelector: (value: T) => CallbackReturnType<K>
) =>
  createOperator("groupBy", (source) => ({
    async next(): Promise<IteratorResult<GroupItem<T, K>>> {
      const result = await source.next();
      if (result.done) return result;

      const key = await keySelector(result.value);
      return { value: { key, value: result.value }, done: false };
    }
  }));
