import { CallbackReturnType, createOperator } from '../abstractions';

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
  comparator?: (prev: T, curr: T) => CallbackReturnType<boolean>
) =>
  createOperator<T, T>('distinctUntilChanged', (source) => {
    let lastValue: T | undefined;
    let hasLast = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          const { value, done } = await source.next();
          if (done) return { value: undefined, done: true };

          if (!hasLast || !(comparator ? await comparator(lastValue!, value) : lastValue === value)) {
            lastValue = value;
            hasLast = true;
            return { value, done: false };
          }
        }
      },
    };
  });
