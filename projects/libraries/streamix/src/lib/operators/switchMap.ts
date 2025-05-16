import { createOperator } from "../abstractions";

export const switchMap = <T, R>(
  project: (value: T, index: number) => AsyncIterable<R>
) =>
  createOperator('switchMap', (source) => {
    const sourceIterator = source[Symbol.asyncIterator]?.() ?? source;
    let innerIterator: AsyncIterator<R> | null = null;
    let innerDone = true;
    let outerDone = false;
    let currentIndex = 0;

    return {
      async next(): Promise<IteratorResult<R>> {
        while (true) {
          // If no active inner or inner completed, pull new outer value and switch
          if (innerDone) {
            const outerResult = await sourceIterator.next();
            if (outerResult.done) {
              outerDone = true;
              return { done: true, value: undefined };
            }
            innerIterator = project(outerResult.value, currentIndex++)[Symbol.asyncIterator]();
            innerDone = false;
          }

          if (innerIterator) {
            const innerResult = await innerIterator.next();

            if (innerResult.done) {
              innerDone = true;
              innerIterator = null;
              // Loop again to get next outer value
              continue;
            }

            // Emit inner value
            return { done: false, value: innerResult.value };
          }
        }
      }
    };
  });
