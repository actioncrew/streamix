import { createOperator } from "../abstractions";

/**
 * Counts the number of items emitted by the source stream.
 * Completes after counting all items and emits the total count once.
 */
export const count = <T = any>() =>
  createOperator<T, number>("count", (source) => {
    let counted = false;
    let total = 0;

    return {
      async next(): Promise<IteratorResult<number>> {
        if (counted) return { done: true, value: undefined };

        while (true) {
          const { done } = await source.next();
          if (done) break;
          total++;
        }

        counted = true;
        return { done: false, value: total };
      },
    };
  });
