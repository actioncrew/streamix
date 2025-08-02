import { createOperator } from "../abstractions";

/**
 * Prepends the stream with an initial value emitted before the source values.
 */
export const startWith = <T = any>(initialValue: T) =>
  createOperator<T, T>("startWith", (source) => {
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
