import { createOperator, Stream } from "../abstractions";
import { eachValueFrom } from "../converters";

/**
 * Projects each value from the source stream to an inner stream,
 * then flattens those inner streams sequentially (one after another).
 * Emits all values from one inner stream before moving to the next.
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
