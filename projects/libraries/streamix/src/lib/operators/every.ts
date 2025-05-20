import { createOperator } from "../abstractions";

export const every = <T = any>(
  predicate: (value: T, index: number) => boolean
) =>
  createOperator("every", (source) => {
    let index = 0;
    let emitted = false;

    return {
      async next(): Promise<IteratorResult<boolean>> {
        if (emitted) return { done: true, value: undefined };

        while (true) {
          const { value, done } = await source.next();

          if (done) {
            emitted = true;
            return { done: false, value: true };
          }

          if (!predicate(value, index++)) {
            emitted = true;
            return { done: false, value: false };
          }
        }
      },
    };
  });
