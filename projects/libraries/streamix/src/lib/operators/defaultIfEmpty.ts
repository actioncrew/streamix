import { createOperator } from "../abstractions";

/**
 * Emits all values from the source stream.
 * If the source completes without emitting any values,
 * emits the provided default value once before completing.
 */
export const defaultIfEmpty = <T = any>(defaultValue: T) =>
  createOperator<T, T>("defaultIfEmpty", (source) => {
    let emitted = false;
    let done = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        if (done) return { done: true, value: undefined };

        const result = await source.next();

        if (!result.done) {
          emitted = true;
          return result;
        }

        if (!emitted) {
          emitted = true;
          done = true;
          return { done: false, value: defaultValue };
        }

        done = true;
        return { done: true, value: undefined };
      }
    };
  });
