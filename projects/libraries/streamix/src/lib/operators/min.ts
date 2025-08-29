import { createOperator, createStreamResult, DONE, NEXT, Operator } from '../abstractions';

/**
 * Creates a stream operator that emits the minimum value from the source stream.
 *
 * This is a terminal operator that must consume the entire source stream before
 * it can emit a single value. It iterates through all values, keeping track of
 * the smallest one seen so far.
 *
 * @template T The type of the values in the source stream.
 * @param comparator An optional function to compare two values. It should return a negative
 * number if `a` is less than `b`, a positive number if `a` is greater than `b`, and zero
 * if they are equal. Defaults to using the `<` operator for comparison.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
/**
 * Creates a stream operator that emits the minimum value from the source stream.
 *
 * This is a terminal operator that consumes the source lazily.
 * It keeps track of the smallest value seen so far and emits phantoms for intermediate values.
 *
 * @template T The type of the values in the source stream.
 * @param comparator Optional function to compare two values. Returns negative if `a < b`.
 * @returns An `Operator` instance usable in a stream's `pipe` method.
 */
export const min = <T = any>(
  comparator?: (a: T, b: T) => number | Promise<number>
) =>
  createOperator<T, T>("min", function (this: Operator, source, context) {

    let minValue: T | undefined;
    let hasMin = false;
    let emittedMin = false;

    return {
      next: async () => {
        while (true) {
          const result = createStreamResult(await source.next());

          if (result.done) {
            // Emit the final minimum once
            if (hasMin && !emittedMin) {
              emittedMin = true;
              return NEXT(minValue!);
            }
            return DONE;
          }

          const value = result.value;

          if (!hasMin) {
            minValue = value;
            hasMin = true;
            continue;
          }

          const cmp = comparator ? await comparator(value, minValue!) : (value < minValue! ? -1 : 1);

          if (cmp < 0) {
            // previous min becomes phantom
            minValue = value;
          }

          await context?.markPhantom(this, result);
        }
      },
    };
  });
