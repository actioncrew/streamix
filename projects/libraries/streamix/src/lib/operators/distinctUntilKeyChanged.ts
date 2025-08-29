import { createOperator, createStreamResult, NEXT, Operator } from '../abstractions';

/**
 * Creates a stream operator that filters out consecutive values from the source
 * stream if a specified key's value has not changed.
 *
 * This operator is a specialized version of `distinctUntilChanged`. It is designed
 * to work with streams of objects and checks for uniqueness based on the value
 * of a single property (`key`).
 *
 * @template T The type of the objects in the stream. Must extend `object`.
 * @param key The name of the property to check for changes.
 * @param comparator An optional function to compare the previous and current values of the `key`.
 * It should return `true` if the values are considered the same. If not provided,
 * strict inequality (`!==`) is used.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */

export const distinctUntilKeyChanged = <T extends object = any>(
  key: keyof T,
  comparator?: (prev: T[typeof key], curr: T[typeof key]) => boolean | Promise<boolean>
): Operator<T, T> =>
  createOperator<T, T>('distinctUntilKeyChanged', function (this: Operator, source, context) {
    let lastValue: T | undefined;
    let isFirst = true;

    return {
      next: async () => {
        while (true) {
          // CORRECT: source.next() already returns StreamResult, no need to wrap
          const result = await source.next();

          if (result.done) return result;

          const current = result.value;

          const isDistinct = isFirst || (
            comparator
              ? !(await comparator(lastValue![key], current[key]))
              : lastValue![key] !== current[key]
          );

          isFirst = false;

          if (isDistinct) {
            lastValue = current;
            return NEXT(current);
          } else {
            if (context) {
              const phantomResult = createStreamResult({
                value: current,
                type: 'phantom',
                done: true
              });
              context.markPhantom(this, phantomResult);
            }
            continue;
          }
        }
      }
    };
  });
