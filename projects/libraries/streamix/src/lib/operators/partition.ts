import { createOperator } from "../abstractions";
import { GroupItem } from "./groupBy";

export const partition = <T = any>(
  predicate: (value: T, index: number) => boolean
) =>
  createOperator('partition', (source) => {
    let index = 0;

    return {
      async next(): Promise<IteratorResult<GroupItem<T, "true" | "false">>> {
        const result = await source.next();
        if (result.done) {
          return { value: undefined, done: true };
        }
        const key = predicate(result.value, index++) ? "true" : "false";
        return { value: { key, value: result.value }, done: false };
      }
    };
  });
