import { createOperator } from "../abstractions";

export const endWith = <T = any>(finalValue: T) =>
  createOperator("endWith", (source) => {
    let sourceDone = false;
    let finalEmitted = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        if (!sourceDone) {
          const result = await source.next();
          if (!result.done) return result;
          sourceDone = true;
        }

        if (!finalEmitted) {
          finalEmitted = true;
          return { done: false, value: finalValue };
        }

        return { done: true, value: undefined };
      }
    };
  });
