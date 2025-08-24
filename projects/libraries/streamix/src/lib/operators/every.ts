import { CallbackReturnType, createOperator, createStreamResult, DONE, NEXT, Operator } from "../abstractions";

/**
 * Creates a stream operator that tests if all values from the source stream satisfy a predicate.
 *
 * This operator consumes the source stream and applies the provided `predicate` function
 * to each value.
 * - If the `predicate` returns a truthy value for every element until the source stream
 * completes, the operator emits `true`.
 * - If the `predicate` returns a falsy value for any element, the operator immediately
 * emits `false` and then completes, effectively "short-circuiting" the evaluation.
 *
 * This is a "pull-based" equivalent of `Array.prototype.every` and is useful for validating
 * data streams. The operator will emit only a single boolean value before it completes.
 *
 * @template T The type of the values in the source stream.
 * @param predicate The function to test each value. It receives the value and its index.
 * It can be synchronous or asynchronous.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const every = <T = any>(
  predicate: (value: T, index: number) => CallbackReturnType<boolean>
) =>
  createOperator<T, boolean>("every", function (this: Operator, source) {
    let index = 0;
    let emitted = false;

    return {
      next: async () => {
        if (emitted) return DONE;

        while (true) {
          const result = createStreamResult(await source.next());

          if (result.done) {
            emitted = true;
            return NEXT(true);
          }

          if (!await predicate(result.value, index++)) {
            emitted = true;
            return NEXT(false);
          }
        }
      },
    };
  });
