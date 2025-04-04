import { createStream, Stream, StreamMapper, createMapper } from '../abstractions'; // Adjust path as needed

/**
 * Creates a stream mapper that prepends a specified initial value
 * to the sequence emitted by the source stream, using an async generator.
 *
 * @template T The type of the initial value.
 * @template S The type of the values emitted by the source stream.
 * @param initialValue The value to emit first.
 * @returns A StreamMapper function that transforms an input Stream<S> into an output Stream<T | S>.
 */
export const startWith = <T = any>(initialValue: T): StreamMapper => {
  const operator = (input: Stream<T>): Stream<T> => {
    return createStream('startWith', async function* () {
      // Yield the initial value first.
      yield initialValue;

      // Delegate yielding to the input stream.
      yield* input;
    });
  };

  // Wrap the operator logic using createMapper
  return createMapper('startWith', operator);
};
