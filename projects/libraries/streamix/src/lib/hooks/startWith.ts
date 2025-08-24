import { createOperator, createStreamResult, DONE, NEXT, Operator } from "../abstractions";

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
  createOperator<T, T>("startWith", function (this: Operator, source) {
    let emittedInitial = false;
    let completed = false;

    return {
      next: async () => {
        while (true) {
          if (completed) {
            return DONE;
          }

          if (!emittedInitial) {
            emittedInitial = true;
            return NEXT(initialValue);
          }

          const result = createStreamResult(await source.next());
          if (result.done) {
            completed = true;
            return DONE;
          }

          return result;
        }
      }
    };
  });
