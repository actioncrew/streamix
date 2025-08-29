import { createOperator, createStreamResult, DONE, NEXT, Operator } from '../abstractions';

/**
 * Creates a stream operator that emits the maximum value from the source stream.
 *
 * This is a terminal operator that consumes the entire source lazily,
 * emitting phantoms along the way and finally emitting the maximum value.
 *
 * @template T The type of the values in the source stream.
 * @param comparator Optional comparison function: positive if `a > b`, negative if `a < b`.
 * @returns An `Operator` instance usable in a stream's `pipe` method.
 */
export const max = <T = any>(
  comparator?: (a: T, b: T) => number | Promise<number>
) =>
  createOperator<T, T>("max", function (this: Operator, source, context) {
    let maxValue: T | undefined;
    let hasMax = false;
    let emittedMax = false;

    return {
      next: async () => {
        while (true) {
          // If all values processed, emit max once and complete
          if (emittedMax && !hasMax) return DONE;
          if (emittedMax && hasMax) {
            emittedMax = true;
            return DONE;
          }

          const result = createStreamResult(await source.next());

          if (result.done) {
            // Emit final max if exists
            if (hasMax && !emittedMax) {
              emittedMax = true;
              return NEXT(maxValue!);
            }
            return DONE;
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

          await context?.markPhantom(this, result);
        }
      },
    };
  });
