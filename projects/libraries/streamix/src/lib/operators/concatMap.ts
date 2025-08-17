import { createOperator, Stream } from "../abstractions";
import { eachValueFrom } from "../converters";

/**
 * Creates a stream operator that projects each value from the source stream to an
 * inner stream and then flattens all inner streams sequentially.
 *
 * This operator combines mapping and concatenation. For each value from the source
 * stream, it calls the `project` function to create a new, inner stream. It then
 * subscribes to these inner streams one by one, waiting for each to complete
 * before moving to the next. The output is a single, flattened stream containing
 * all values from all inner streams in the order they were processed.
 *
 * @template T The type of values in the source stream.
 * @template R The type of values in the inner and output streams.
 * @param project A function that takes a value from the source stream and its index,
 * and returns a new stream to be flattened.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const concatMap = <T = any, R = any>(
  project: (value: T, index: number) => Stream<R>
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
            innerIterator = eachValueFrom<R>(project(outerResult.value, outerIndex++));
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
