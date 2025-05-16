import { createOperator } from "../abstractions";

export const delay = <T>(ms: number) =>
  createOperator("delay", (source) => {
    return {
      async next(): Promise<IteratorResult<T>> {
        const result = await source.next();
        if (result.done) return result;

        await new Promise(resolve => setTimeout(resolve, ms));
        return result;
      }
    };
  });
