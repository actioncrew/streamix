import { CallbackReturnType, createOperator, createStreamResult, DONE, NEXT, Operator } from '../abstractions';

/**
 * Creates a stream operator that skips values from the source stream while a predicate returns true.
 *
 * This operator is a powerful filtering tool for removing a contiguous prefix of a stream.
 * It consumes values from the source and applies the `predicate` function to each one.
 * As long as the predicate returns `true`, the values are ignored. As soon as the predicate
 * returns `false` for the first time, this operator begins to emit that value and all
 * subsequent values from the source, regardless of whether they satisfy the predicate.
 *
 * @template T The type of the values in the source and output streams.
 * @param predicate The function to test each value. `true` means to continue skipping,
 * and `false` means to stop skipping and begin emitting.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const skipWhile = <T = any>(
  predicate: (value: T) => CallbackReturnType<boolean>
) =>
  createOperator<T, T>('skipWhile', function (this: Operator, source) {
    let skipping = true;

    return {
      next: async () => {
        while (true) {
          const result = createStreamResult(await source.next());

          if (result.done) return DONE;

          if (skipping) {
            if (!await predicate(result.value)) {
              skipping = false;
              return NEXT(result.value);
            }
            // Still skipping, ignore this value
          } else {
            return NEXT(result.value);
          }
        }
      }
    };
  });
