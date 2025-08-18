import { CallbackReturnType, createOperator, Stream } from "../abstractions";
import { eachValueFrom, fromAny } from "../converters";

/**
 * Creates a stream operator that maps each value from the source stream to a new
 * inner stream (or value/array/promise) and flattens all inner streams sequentially.
 *
 * For each value from the source:
 * 1. The `project` function is called with the value and its index.
 * 2. The returned value is normalized into a stream using {@link fromAny}.
 * 3. The inner stream is consumed fully before processing the next outer value.
 *
 * This ensures that all emitted values maintain their original sequential order.
 *
 * @template T The type of values in the source stream.
 * @template R The type of values emitted by the inner streams and the output.
 * @param project A function that takes a value from the source stream and its index,
 * and returns either:
 *   - a {@link Stream<R>},
 *   - a {@link CallbackReturnType<R>} (value or promise),
 *   - or an array of `R`.
 * @returns An {@link Operator} instance that can be used in a stream's `pipe` method.
 */
export const concatMap = <T = any, R = any>(
  project: (value: T, index: number) => Stream<R> | CallbackReturnType<R> | Array<R>
) =>
  createOperator<T, R>("concatMap", (source) => {
    let outerIndex = 0;
    let innerIterator: AsyncIterator<R> | null = null;

    // Async iterator object that sequentially flattens projected inner async iterables
    return {
      async next(): Promise<IteratorResult<R>> {
        while (true) {
          // If no active inner iterator, get next outer value and create one
          if (!innerIterator) {
            const outerResult = await source.next();
            if (outerResult.done) {
              return { done: true, value: undefined };
            }
            innerIterator = eachValueFrom<R>(fromAny(project(outerResult.value, outerIndex++)));
          }

          // Pull from the active inner iterator
          const innerResult = await innerIterator.next();
          if (innerResult.done) {
            innerIterator = null; // Finished this inner stream, go back to outer
            continue; // loop again to fetch next outer value
          }
          // Return next inner value
          return { done: false, value: innerResult.value };
        }
      }
    };
  });
