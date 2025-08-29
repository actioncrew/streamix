import { CallbackReturnType, createOperator, createStreamResult, NEXT, Operator } from "../abstractions";

/**
 * Creates a stream operator that emits values from the source stream as long as
 * a predicate returns true.
 *
 * This operator is a conditional limiter. It consumes values from the source stream
 * and applies the `predicate` function to each. As long as the predicate returns `true`,
 * the value is passed through to the output stream. The first time the predicate returns
 * a falsy value, the operator stops emitting and immediately completes the output stream.
 * The value that caused the predicate to fail is not emitted.
 *
 * This is useful for taking a contiguous block of data from a stream that meets a certain
 * condition, such as processing user input until an invalid entry is made.
 *
 * @template T The type of the values in the source and output streams.
 * @param predicate The function to test each value. `true` means to continue emitting,
 * and `false` means to stop and complete. It can be synchronous or asynchronous.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const takeWhile = <T = any>(
  predicate: (value: T) => CallbackReturnType<boolean>
) =>
  createOperator<T, T>("takeWhile", function (this: Operator, source, context) {
    let active = true; // controls real values

    return {
      next: async () => {
        while (true) {
          const result = createStreamResult(await source.next());

          if (result.done) return result;

          if (!active) {
            await context?.markPhantom(this, result);
            continue;
          }

          const pass = await predicate(result.value);
          if (!pass) {
            active = false;
            await context?.markPhantom(this, result);
            continue;
          }

          return NEXT(result.value);
        }
      },
    };
  });
