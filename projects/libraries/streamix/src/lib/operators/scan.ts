import { CallbackReturnType, createOperator, createStreamResult, DONE, NEXT, Operator } from "../abstractions";

/**
 * Creates a stream operator that accumulates values from the source stream,
 * emitting each intermediate accumulated result.
 *
 * This operator is stateful and is ideal for scenarios where you need to maintain
 * a running total or build a state object over the life of a stream. It takes a
 * `seed` value and an `accumulator` function. For each value from the source,
 * it applies the accumulator and emits the new result immediately.
 *
 * @template T The type of the values in the source stream.
 * @template R The type of the accumulated value and the output stream.
 * @param accumulator The function that combines the current accumulated value
 * with the new value from the source. This function can be synchronous or asynchronous.
 * @param seed The initial value for the accumulator.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */

export const scan = <T = any, R = any>(
  accumulator: (acc: R, value: T, index: number) => CallbackReturnType<R>,
  seed: R
) =>
  createOperator<T, R>("scan", function (this: Operator, source) {
    let acc = seed;
    let index = 0;
    let completed = false;

    return {
      next: async () => {
        while (true) {
          if (completed) {
            return DONE;
          }

          const result = createStreamResult(await source.next());

          if (result.done) {
            completed = true;
            return DONE;
          }

          acc = await accumulator(acc, result.value, index++);
          return NEXT(acc);
        }
      },
    };
  });
