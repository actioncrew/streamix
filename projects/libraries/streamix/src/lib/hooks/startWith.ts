import { createOperator } from "../abstractions";

export const startWith = <T = any>(initialValue: T) =>
  createOperator("startWith", (source) => {
    let emittedInitial = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        if (!emittedInitial) {
          emittedInitial = true;
          return { done: false, value: initialValue };
        }

        return source.next();
      }
    };
  });
