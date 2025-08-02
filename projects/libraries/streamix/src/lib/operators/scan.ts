import { CallbackReturnType, createOperator } from "../abstractions";

/**
 * Accumulates values from the source stream using the provided accumulator function,
 * emitting each intermediate accumulated result.
 */
export const scan = <T = any, R = any>(
  accumulator: (acc: R, value: T, index: number) => CallbackReturnType<R>,
  seed: R
) =>
  createOperator<T, R>("scan", (source) => {
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
