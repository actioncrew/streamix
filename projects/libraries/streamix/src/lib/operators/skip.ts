import { createOperator, createStreamResult, DONE, NEXT, Operator } from '../abstractions';

/**
 * Creates a stream operator that skips the first specified number of values from the source stream.
 *
 * This operator is useful for "fast-forwarding" a stream. It consumes the initial `count` values
 * from the source stream without emitting them to the output. Once the count is reached,
 * it begins to pass all subsequent values through unchanged.
 *
 * @template T The type of the values in the source and output streams.
 * @param count The number of values to skip from the beginning of the stream.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const skip = <T = any>(count: number) =>
  createOperator<T, T>('skip', function (this: Operator, source, context) {
    let counter = count;

    return {
      next: async () => {
        while (true) {
          const result = createStreamResult(await source.next());

          if (result.done) return DONE;

          if (counter > 0) {
            counter--;
            await context?.markPhantom(this, result);
            continue;
          }

          return NEXT(result.value);
        }
      },
    };
  });
