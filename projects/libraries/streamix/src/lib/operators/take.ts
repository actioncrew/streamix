import { createOperator, createStreamResult, DONE, NEXT, Operator } from "../abstractions";

/**
 * Creates a stream operator that emits only the first `count` values from the source stream
 * and then completes.
 *
 * This operator is a powerful tool for controlling the length of a stream. It consumes values
 * from the source one by one, and as long as the total number of values emitted is less than
 * `count`, it passes them through to the output. Once the count is reached, it stops
 * processing the source and signals completion to its downstream consumers. This is especially
 * useful for managing finite segments of large or infinite streams.
 *
 * @template T The type of the values in the source and output streams.
 * @param count The maximum number of values to take from the beginning of the stream.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const take = <T = any>(count: number) =>
  createOperator<T, T>("take", function (this: Operator, source) {
    let emitted = 0;
    let done = false;

    return {
      next: async () => {
        while (true) {
          if (done) {
            return DONE;
          }

          const result = createStreamResult(await source.next());

          if (result.done) {
            done = true;
            return DONE;
          }

          emitted++;

          if (emitted > count) {
            done = true;
            return DONE;
          }

          return NEXT(result.value);
        }
      },
    };
  });
