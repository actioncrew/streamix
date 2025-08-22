import { CallbackReturnType, createOperator } from "../abstractions";

/**
 * Creates a stream operator that accumulates all values from the source stream
 * into a single value using a provided accumulator function.
 *
 * This operator is a powerful aggregation tool. It consumes the entire source
 * stream and applies the `accumulator` function repeatedly to each value,
 * maintaining a running total or state. It will only emit one single value,
 * which is the final accumulated result, and only after the source stream has
 * completed.
 *
 * @template T The type of the values in the source stream.
 * @template A The type of the accumulated value.
 * @param accumulator The function that combines the current accumulated value
 * with the new value from the source. This function can be synchronous or asynchronous.
 * @param seed The initial value for the accumulator.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const reduce = <T = any, A = any>(
  accumulator: (acc: A, value: T) => CallbackReturnType<A>,
  seed: A
) =>
  createOperator<T, A>("reduce", (source) => {
    let completed = false;

    return {
      async next(): Promise<IteratorResult<A>> {
        while (true) {
          if (completed) {
            return { done: true, value: undefined };
          }

          let acc = seed;

          // Consume the entire source stream
          while (true) {
            const result = await source.next();
            if (result.done) {
              break;
            }
            acc = await accumulator(acc, result.value);
          }

          completed = true;
          return { done: false, value: acc };
        }
      },
    };
  });
