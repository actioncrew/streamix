import { createOperator, Stream } from "../abstractions";
import { eachValueFrom } from "../converters";

export const concatMap = <T, R>(
  project: (value: T, index: number) => Stream<R>
) =>
  createOperator("concatMap", (source) => {
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
            innerIterator = eachValueFrom(project(outerResult.value, outerIndex++));
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
