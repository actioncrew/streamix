import { createOperator } from "../abstractions";

export const first = <T = any>(predicate?: (value: T) => boolean) =>
  createOperator("first", (source) => {
    let done = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        if (done) return { done: true, value: undefined as any };

        while (true) {
          const result = await source.next();
          if (result.done) {
            done = true;
            throw new Error("No elements in sequence");
          }

          if (!predicate || predicate(result.value)) {
            done = true;
            return { value: result.value, done: false };
          }
        }
      }
    };
  });
