import { createOperator, createStreamResult, DONE, NEXT, Operator } from "../abstractions";

/**
 * Creates a stream operator that accumulates all values from the source stream
 * into a single value using a provided accumulator function.
 *
 * This operator consumes the source lazily and emits intermediate values as phantoms.
 * It will always emit at least the seed value if the stream is empty.
 *
 * @template T The type of the values in the source stream.
 * @template A The type of the accumulated value.
 * @param accumulator Function combining current accumulated value with a new value.
 * Can be synchronous or asynchronous.
 * @param seed Initial value for the accumulator.
 * @returns An `Operator` instance usable in a stream's `pipe` method.
 */
export const reduce = <T = any, A = any>(
  accumulator: (acc: A, value: T) => Promise<A> | A,
  seed: A
) =>
  createOperator<T, A>("reduce", function (this: Operator, source, context) {

    let finalValue: A = seed;
    let emittedFinal = false;

    return {
      next: async () => {
        while (true) {
          const result = createStreamResult(await source.next());

          if (result.done) {
            if (!emittedFinal) {
              emittedFinal = true;
              return NEXT(finalValue);
            }
            return DONE;
          }

          // Accumulate value
          finalValue = await accumulator(finalValue, result.value);

          // Treat intermediate accumulated value as phantom
          await context?.markPhantom(this, result);
        }
      },
    };
  });
