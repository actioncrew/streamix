import { createOperator } from "../abstractions";

export const count = () =>
  createOperator("count", (source) => {
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
