import { CallbackReturnType, createOperator } from '../abstractions';

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
export const skipWhile = <T = any>(predicate: (value: T) => CallbackReturnType<boolean>) =>
  createOperator<T, T>('skipWhile', (source) => {
    let skipping = true;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          const { value, done } = await source.next();

          if (done) {
            return { value: undefined, done: true };
          }

          if (skipping) {
            if (!await predicate(value)) {
              skipping = false;
              return { value, done: false };
            }
            // If still skipping, continue looping
          } else {
            return { value, done: false };
          }
        }
      }
    };
  });
