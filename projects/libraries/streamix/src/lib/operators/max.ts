import { createOperator } from '../abstractions';
import { CallbackReturnType } from './../abstractions/receiver';

/**
 * Creates a stream operator that emits the maximum value from the source stream.
 *
 * This is a terminal operator that must consume the entire source stream before
 * it can emit a single value. It iterates through all values, keeping track of
 * the largest one seen so far.
 *
 * @template T The type of the values in the source stream.
 * @param comparator An optional function to compare two values. It should return a positive
 * number if `a` is greater than `b`, a negative number if `a` is less than `b`, and zero
 * if they are equal. Defaults to using the `>` operator for comparison.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const max = <T = any>(
  comparator?: (a: T, b: T) => CallbackReturnType<number>
) =>
  createOperator<T, T>('max', (source) => {
    let maxValue: T | undefined;
    let hasMax = false;

    // Process the source eagerly
    const ready = (async () => {
      while (true) {
        const result = await source.next();
        if (result.done) break;
        if (result.phantom) continue;

        if (!hasMax) {
          maxValue = result.value;
          hasMax = true;
        } else if (comparator) {
          if (await comparator(result.value, maxValue!) > 0) {
            maxValue = result.value;
          }
        } else if (result.value > maxValue!) {
          maxValue = result.value;
        }
      }
    })();

    let emitted = false;

    return {
      async next() {
        await ready;

        if (!emitted && hasMax) {
          emitted = true;
          return { value: maxValue!, done: false };
        }

        return { value: undefined, done: true };
      },
    };
  });
