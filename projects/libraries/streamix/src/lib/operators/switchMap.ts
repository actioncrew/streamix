import { createOperator, Stream } from "../abstractions";
import { eachValueFrom } from "../converters";

export const switchMap = <T, R>(
  project: (value: T, index: number) => Stream<R>
) =>
  createOperator('switchMap', (source) => {
    let innerIterator: AsyncIterator<R> | null = null;
    let innerDone = true;
    let currentIndex = 0;

    return {
      async next(): Promise<IteratorResult<R>> {
        while (true) {
          // If no active inner or inner completed, pull new outer value and switch
          if (innerDone) {
            const outerResult = await source.next();
            if (outerResult.done) {
              return { done: true, value: undefined };
            }
            innerIterator = eachValueFrom(project(outerResult.value, currentIndex++));
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
