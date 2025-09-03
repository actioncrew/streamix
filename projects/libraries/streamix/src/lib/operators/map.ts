import { CallbackReturnType, createOperator, createStreamResult, DONE, NEXT, Operator, StreamResult } from '../abstractions';

/**
 * Creates a stream operator that applies a transformation function to each value
 * emitted by the source stream.
 *
 * This operator is a fundamental part of stream processing. It consumes each value
 * from the source, passes it to the `transform` function, and then emits the result
 * of that function. This is a one-to-one mapping, meaning the output stream will
 * have the same number of values as the source stream, but with potentially different
 * content and/or type.
 *
 * @template T The type of the values in the source stream.
 * @template R The type of the values in the output stream.
 * @param transform The transformation function to apply to each value. It receives
 * the value and its index. This function can be synchronous or asynchronous.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const map = <T = any, R = any>(
  transform: (value: T, index: number) => CallbackReturnType<R>
) =>
  createOperator<T, R>('map', function (this: Operator, source) {
    let index = 0;
    let completed = false;

    return {
      async next(): Promise<StreamResult> {
        while (true) {
          if (completed) {
            return DONE;
          }

          const result = createStreamResult(await source.next());
          if (result.done) {
            completed = true;
            return DONE;
          }

          const transformedValue = await transform(result.value, index++);
          return NEXT(transformedValue);
        }
      },
    };
  });
