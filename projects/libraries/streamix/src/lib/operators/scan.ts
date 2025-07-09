import { CallbackReturnType, createOperator } from "../abstractions";

export const scan = <T, R>(
  accumulator: (acc: R, value: T, index: number) => CallbackReturnType<R>,
  seed: R
) =>
  createOperator("scan", (source) => {
    let acc = seed;
    let index = 0;

    return {
      async next(): Promise<IteratorResult<R>> {
        const { done, value } = await source.next();
        if (done) {
          return { done: true, value: undefined };
        }
        acc = await accumulator(acc, value, index++);
        return { done: false, value: acc };
      },
    };
  });
