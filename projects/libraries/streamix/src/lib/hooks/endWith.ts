import { createOperator, createStreamResult, DONE, NEXT, Operator } from "../abstractions";

/**
 * Creates a stream operator that emits a final, specified value after the source stream has completed.
 *
 * The operator first consumes all values from the upstream source. Once the source stream signals
 * its completion (`done`), this operator then emits the `finalValue` and immediately completes.
 *
 * @template T The type of the values in the stream.
 * @param finalValue The value to be emitted as the last item in the stream.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const endWith = <T = any>(finalValue: T) =>
  createOperator<T, T>("endWith", function (this: Operator, source) {
    let sourceDone = false;
    let finalEmitted = false;
    let completed = false;

    return {
      next: async () => {
        while (true) {
          if (completed) {
            return DONE;
          }

          if (!sourceDone) {
            const result = createStreamResult(await source.next());

            if (!result.done) {
              return result;
            }

            sourceDone = true;
          }


          if (!finalEmitted) {
            finalEmitted = true;
            return NEXT(finalValue);
          }

          completed = true;
          return DONE;
        }
      }
    };
  });
