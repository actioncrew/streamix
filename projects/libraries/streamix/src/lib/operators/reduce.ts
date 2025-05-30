import { createOperator } from "../abstractions";

export const reduce = (
  accumulator: (acc: any, value: any) => any,
  seed: any
) =>
  createOperator("reduce", (source) => {
    let done = false;

    return {
      async next(): Promise<IteratorResult<any>> {
        if (done) return { done: true, value: undefined };

        let acc = seed;
        for await (const result of {
          async *[Symbol.asyncIterator]() {
            while (true) {
              const { done, value } = await source.next();
              if (done) break;
              acc = accumulator(acc, value);
            }
            yield acc;
          },
        }) {
          done = true;
          return { done: false, value: result };
        }

        return { done: true, value: undefined };
      },
    };
  });
