import { createOperator } from "../abstractions";

export const ignoreElements = () =>
  createOperator("ignoreElements", (source) => ({
    async next(): Promise<IteratorResult<never>> {
      while (true) {
        const result = await source.next();
        if (result.done) return result;
        // Ignore the value and continue
      }
    }
  }));
