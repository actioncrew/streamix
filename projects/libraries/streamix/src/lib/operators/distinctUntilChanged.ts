import { createOperator, createStreamResult, DONE, Operator } from '../abstractions';

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
    let lastValue: T | undefined;
    let hasLast = false;

    return {
      next: async () => {
        while (true) {
          const result = createStreamResult(await source.next());

          if (result.done) return DONE;

          // Check if the value is different from the last one
          const isDistinct = !hasLast ||
            !(comparator ? comparator(lastValue!, result.value) : lastValue === result.value);

          if (isDistinct) {
            // If distinct, update state and return
            lastValue = result.value;
            hasLast = true;
            return createStreamResult({ value: result.value, done: false });
          } else {
            // If duplicate, create proper phantom result
            if (context) {
              const phantomResult = createStreamResult({
                value: result.value,
                type: 'phantom',
                done: true
              });
              context.markPhantom(this, phantomResult);
            }
            continue;
          }
        }
      },
    };
  });
