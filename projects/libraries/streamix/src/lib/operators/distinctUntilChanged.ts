import { createOperator, createStreamResult, DONE, NEXT, Operator } from '../abstractions';

/**
 * Creates a stream operator that emits values from the source stream only if
 * they are different from the previous value.
 *
 * This operator filters out consecutive duplicate values, ensuring that the
 * output stream only contains values that have changed since the last emission.
 * It's particularly useful for preventing redundant updates in data streams.
 *
 * @template T The type of the values in the stream.
 * @param comparator An optional function that compares the previous and current values.
 * It should return `true` if they are considered the same, and `false` otherwise.
 * If not provided, a strict equality check (`===`) is used.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const distinctUntilChanged = <T = any>(
  comparator?: (prev: T, curr: T) => boolean
) =>
  createOperator<T, T>('distinctUntilChanged', function (this: Operator, source, context) {
    const sc = context?.currentStreamContext();
    // State variables to keep track of the last emitted value.
    let lastValue: T | undefined;
    let hasLast = false;

    // The next() method now contains all the logic for a single value.
    return {
      next: async () => {
        while (true) {
          // Await the next value from the source stream.
          const result = createStreamResult(await source.next());

          // If the source stream is done, we are also done.
          if (result.done) return DONE;

          // Check if the value is different from the last one.
          const isDistinct = !hasLast || !(comparator ? comparator(lastValue!, result.value) : lastValue === result.value);

          if (isDistinct) {
            // If the value is distinct, we update our state and return it as a normal StreamResult.
            lastValue = result.value;
            hasLast = true;
            return NEXT(result.value);
          } else {
            // If the value is a consecutive duplicate, we do not update the lastValue,
            // and instead, we return a phantom StreamResult to signal that a value was dropped.
            await sc?.phantomHandler(this, result.value);
            continue;
          }
        }
      },
    };
  });
