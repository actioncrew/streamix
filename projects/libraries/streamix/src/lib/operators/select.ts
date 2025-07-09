import { createOperator } from "../abstractions";

export const select = <T = any>(indexIterator: Iterator<number> | AsyncIterator<number>) =>
  createOperator("select", (source) => {
    let currentIndex = 0;
    let nextIndexPromise = indexIterator.next();

    return {
      async next(): Promise<IteratorResult<T>> {
        let nextIndexResult = await nextIndexPromise;
        let nextIndex = nextIndexResult.value;

        while (true) {
          if (nextIndex === undefined) {
            return { done: true, value: undefined };
          }

          const { done, value } = await source.next();
          if (done) {
            return { done: true, value: undefined };
          }

          if (currentIndex === nextIndex) {
            // Schedule next index fetch
            nextIndexPromise = indexIterator.next();
            currentIndex++;
            return { done: false, value };
          }

          currentIndex++;
          // Skip this value, continue loop
        }
      },
    };
  });
