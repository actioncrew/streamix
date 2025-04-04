import { createMapper, createStream, Stream, StreamMapper } from '../abstractions';
import { eachValueFrom } from '../converters';

/**
 * Creates a stream mapper that emits all values from the source stream,
 * and then emits a specified final value upon normal completion of the source.
 * If the source errors, the final value is not emitted, and the error is propagated.
 *
 * @template T The type of the final value to emit.
 * @param endValue The value to emit after the source stream completes normally.
 * @returns A StreamMapper function that transforms an input Stream<T> into an output Stream<T>.
 */
export const endWith = <T = any>(endValue: T): StreamMapper => {
  const operator = (input: Stream<T>): Stream<T> => {
    // Create the output stream using an async generator factory.
    return createStream('endWith', async function* () {
      // Delegate yielding to the input stream first.
      yield* eachValueFrom(input);

      // Yield the endValue.
      yield endValue;
    });
  };

  // Wrap the operator logic using createMapper
  return createMapper('endWith', operator);
};
