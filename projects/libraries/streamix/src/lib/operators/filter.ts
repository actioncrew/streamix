import { createOperator, createStreamResult, NEXT, Operator } from '../abstractions';
import { CallbackReturnType } from './../abstractions/receiver';

/**
 * Creates a stream operator that filters values emitted by the source stream.
 *
 * This operator provides flexible filtering capabilities. It processes each value
 * from the source stream and passes it through to the output stream only if it meets
 * a specific criterion.
 *
 * The filtering can be configured in one of three ways:
 * - A **predicate function**: A function that returns `true` for values to be included.
 * - A **single value**: Only values that are strictly equal (`===`) to this value are included.
 * - An **array of values**: Only values that are present in this array are included.
 *
 * @template T The type of the values in the stream.
 * @param predicateOrValue The filtering criterion. Can be a predicate function, a single value, or an array of values.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const filter = <T = any>(
  predicateOrValue: ((value: T, index: number) => CallbackReturnType<boolean>) | T | T[]
) =>
  createOperator<T, T>('filter', function (this: Operator, source, context) {
    let index = 0;

    return {
      next: async () => {
        while (true) {
          const result = createStreamResult(await source.next());
          if (result.done) return result;

          const value = result.value;
          let shouldInclude = false;

          if (typeof predicateOrValue === 'function') {
            shouldInclude = await (predicateOrValue as (value: T, index: number) => CallbackReturnType<boolean>)(value, index);
          } else if (Array.isArray(predicateOrValue)) {
            shouldInclude = predicateOrValue.includes(value);
          } else {
            shouldInclude = value === predicateOrValue;
          }

          if (shouldInclude) {
            index++;
            return NEXT(value);
          }

          // CORRECT: Use markPhantom to create a proper phantom result
          const phantomResult = context?.createResult({
            value: value,
            type: 'phantom',
            done: true
          });
          context?.markPhantom(this, phantomResult!);

          // Continue to next value
          continue;
        }
      }
    };
  });
