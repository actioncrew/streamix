import { createOperator } from "../abstractions";

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
  accumulator: (acc: A, value: T) => Promise<A> | A,
  seed: A
) =>
  createOperator<T, A>("reduce", (source) => {
    let finalValue: A = seed;
    let emittedFinal = false;

    return {
      async next(): Promise<IteratorResult<A>> {
        while (true) {
          const result = await source.next();

          if (result.done) {
            if (!emittedFinal) {
              emittedFinal = true;
              return { done: false, value: finalValue }; // emit seed if stream is empty
            }
            return { done: true, value: undefined };
          }

          // Accumulate value
          finalValue = await accumulator(finalValue, result.value);

          // Treat intermediate accumulated value as phantom
          continue;
        }
      },
    };
  });
