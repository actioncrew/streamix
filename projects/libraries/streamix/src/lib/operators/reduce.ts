import { CallbackReturnType, createOperator } from "../abstractions";

/**
 * Accumulates all values from the source stream using the provided accumulator function,
 * emitting the final accumulated result once the source completes.
 */
export const reduce = <T = any, A = any>(
  accumulator: (acc: A, value: T) => CallbackReturnType<A>,
  seed: A
) =>
  createOperator<T, A>("reduce", (source) => {
    let done = false;

    return {
      async next(): Promise<IteratorResult<A>> {
        if (done) return { done: true, value: undefined };

        let acc = seed;

        for await (const result of {
          async *[Symbol.asyncIterator]() {
            while (true) {
              const { done, value } = await source.next();
              if (done) break;
              acc = await accumulator(acc, value as T);
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
