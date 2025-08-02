import { createOperator } from "../abstractions";

export const ignoreElements = <T>() =>
  createOperator<T, never>("ignoreElements", (source) => ({
    async next(): Promise<IteratorResult<never>> {
      while (true) {
        const result = await source.next();
        if (result.done) {
          return { done: true, value: undefined as never };
        }
      }
    }
  }));
