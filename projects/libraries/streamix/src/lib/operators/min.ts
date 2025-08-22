import { CallbackReturnType, createOperator } from '../abstractions';

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
export const min = <T = any>(
  comparator?: (a: T, b: T) => CallbackReturnType<number>
) =>
  createOperator<T, T>('min', (source) => {
    let minValue: T | undefined;
    let hasMin = false;

    // Await entire source and compute min eagerly
    const ready = (async () => {
      while (true) {
        const result = await source.next();
        if (result.done) break;
        if (result.phantom) continue;

        if (!hasMin) {
          minValue = result.value;
          hasMin = true;
        } else if (comparator) {
          if (await comparator(result.value, minValue!) < 0) {
            minValue = result.value;
          }
        } else if (result.value < minValue!) {
          minValue = result.value;
        }
      }
    })();

    let emitted = false;

    return {
      async next() {
        await ready;

        if (!emitted && hasMin) {
          emitted = true;
          return { value: minValue!, done: false };
        }

        return { value: undefined, done: true };
      },
    };
  });
