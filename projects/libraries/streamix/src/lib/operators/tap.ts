import { createOperator, createStreamResult, Operator } from '../abstractions';
import { CallbackReturnType } from './../abstractions/receiver';

/**
 * Creates a stream operator that performs a side-effect for each value from the source
 * stream without modifying the value.
 *
 * This operator is primarily used for debugging, logging, or other non-intrusive
 * actions that need to be performed on each value as it passes through the pipeline.
 * It is completely transparent to the data stream itself, as it does not transform,
 * filter, or buffer the values. The provided `tapFunction` is executed for each
 * value before the value is emitted to the next operator.
 *
 * @template T The type of the values in the source and output streams.
 * @param tapFunction The function to perform the side-effect. It receives the value
 * from the stream and can be synchronous or asynchronous.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const tap = <T = any>(tapFunction: (value: T) => CallbackReturnType) =>
  createOperator<T, T>('tap', function (this: Operator, source) {
    return {
      next: async () => {
        while(true) {
          const result = createStreamResult(await source.next());

          if (result.done) return result;

          await tapFunction(result.value); // side-effect
          return result;
        }
      }
    };
  });
