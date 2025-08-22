import { CallbackReturnType, createOperator } from "../abstractions";
import { StreamResult } from './../abstractions/stream';

/**
 * Creates a stream operator that tests if at least one value from the source stream satisfies a predicate.
 *
 * This operator consumes the source stream and applies the provided `predicate` function
 * to each value.
 * - If the `predicate` returns a truthy value for any element, the operator immediately
 * emits `true` and then completes, effectively "short-circuiting" the evaluation.
 * - If the source stream completes without the `predicate` ever returning a truthy value,
 * the operator emits `false`.
 *
 * This is a "pull-based" equivalent of `Array.prototype.some` and is useful for validating
 * data streams. The operator will emit only a single boolean value before it completes.
 *
 * @template T The type of the values in the source stream.
 * @param predicate The function to test each value. It receives the value and its index.
 * It can be synchronous or asynchronous.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const some = <T = any>(
  predicate: (value: T, index: number) => CallbackReturnType<boolean>
) =>
  createOperator<T, boolean>('some', (source) => {
    let evaluated = false;
    let result: boolean = false;
    let index = 0;

    return {
      async next(): Promise<StreamResult<boolean>> {
        if (evaluated) {
          return { value: undefined, done: true };
        }

        try {
          while (true) {
            const itemResult = await source.next();
            if (itemResult.done) {
              break; // Source completed
            }
            if (await predicate(itemResult.value, index++)) {
              result = true;
              break; // Predicate matched, no need to continue
            }
          }
        } catch (err) {
          throw err;
        } finally {
          evaluated = true;
        }

        return { value: result, done: false };
      }
    };
  });
