import { createOperator } from "../abstractions";

export const takeWhile = <T>(predicate: (value: T) => boolean) =>
  createOperator("takeWhile", (source) => {
    let done = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        if (done) return { done: true, value: undefined };

        const result = await source.next();

        if (result.done) {
          done = true;
          return result;
        }

        if (!predicate(result.value)) {
          done = true;
          return { done: true, value: undefined };
        }

        return result;
      }
    };
  });
