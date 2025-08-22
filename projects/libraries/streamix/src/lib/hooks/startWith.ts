import { createOperator } from "../abstractions";

/**
 * Creates a stream operator that prepends a specified value to the beginning of the stream.
 *
 * The operator first emits the `initialValue` immediately upon being iterated.
 * After this initial emission, it begins to pull and emit values from the
 * source stream as they become available.
 *
 * @template T The type of the values in the stream.
 * @param initialValue The value to be emitted as the first item in the stream.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const startWith = <T = any>(initialValue: T) =>
  createOperator<T, T>("startWith", (source) => {
    let emittedInitial = false;
    let completed = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          if (completed) {
            return { done: true, value: undefined };
          }

          if (!emittedInitial) {
            emittedInitial = true;
            return { done: false, value: initialValue };
          }

          const result = await source.next();
          if (result.done) {
            completed = true;
            return { done: true, value: undefined };
          }

          return result;
        }
      }
    };
  });
