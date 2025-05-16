import { createOperator } from "../abstractions";

export const select = <T = any>(indexIterator: Iterator<number>) =>
  createOperator("select", (source) => {
    const sourceIterator = source[Symbol.asyncIterator]?.() ?? source;
    let currentIndex = 0;
    let nextIndex = indexIterator.next().value;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          if (nextIndex === undefined) {
            // No more indices to select, complete
            return { done: true, value: undefined };
          }

          const { done, value } = await sourceIterator.next();
          if (done) {
            // Input ended
            return { done: true, value: undefined };
          }

          if (currentIndex === nextIndex) {
            // Emit this selected value and advance nextIndex
            nextIndex = indexIterator.next().value;
            currentIndex++;
            return { done: false, value };
          }

          currentIndex++;
          // Skip this value, continue looping
        }
      },
    };
  });
