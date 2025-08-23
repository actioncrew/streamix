import { createOperator } from '../abstractions';

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
  comparator?: (a: T, b: T) => number | Promise<number>
) =>
  createOperator<T, T>("max", (source) => {
    let maxValue: T | undefined;
    let hasMax = false;
    let emittedMax = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          // If all values processed, emit max once and complete
          if (emittedMax && !hasMax) return { done: true, value: undefined };
          if (emittedMax && hasMax) {
            emittedMax = true;
            return { done: true, value: undefined };
          }

          const result = await source.next();

          if (result.done) {
            // Emit final max if exists
            if (hasMax && !emittedMax) {
              emittedMax = true;
              return { done: false, value: maxValue! };
            }
            return { done: true, value: undefined };
          }

          const value = result.value;

          if (!hasMax) {
            maxValue = value;
            hasMax = true;
            continue;
          }

          let cmp = comparator ? await comparator(value, maxValue!) : (value > maxValue! ? 1 : -1);

          if (cmp > 0) {
            // previous max becomes phantom
            maxValue = value;
          }
        }
      },
    };
  });
