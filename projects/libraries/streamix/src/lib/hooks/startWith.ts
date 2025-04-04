import { createStream, Stream, StreamMapper, createMapper } from '../abstractions'; // Adjust path as needed
import { eachValueFrom } from '../converters';
/**
 * Creates a stream mapper that prepends a specified initial value
 * to the sequence emitted by the source stream, using an async generator.
 *
 * @template T The type of the initial value.
 * @param initialValue The value to emit first.
 * @returns A StreamMapper function that transforms an input Stream<T> into an output Stream<T>.
 */
export const startWith = <T = any>(initialValue: T): StreamMapper => {
  const operator = (input: Stream<T>): Stream<T> => {
    return createStream('startWith', async function* () {
      // Yield the initial value first.
      yield initialValue;

      // Delegate yielding to the input stream.
      yield* eachValueFrom(input);
    });
  };

  // Wrap the operator logic using createMapper
  return createMapper('startWith', operator);
};
