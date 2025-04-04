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

// Example Usage (conceptual)
// Assuming 'of', 'throwError' operators and 'toArray', 'toPromise' consumers exist

// const source1 = of(1, 2); // Emits 1, 2, then completes
// const resultStream1 = source1.pipe(endWith(3));
// const output1 = await toArray(resultStream1); // output1 would be [1, 2, 3]

// const source2 = throwError(new Error('Source failed')); // Emits error immediately
// const resultStream2 = source2.pipe(endWith(99));
// try {
//   await toArray(resultStream2);
// } catch (err) {
//   // err.message would be 'Source failed'
//   // 99 was NOT emitted.
// }

// const source3 = empty(); // Emits nothing, just completes
// const resultStream3 = source3.pipe(endWith(0));
// const output3 = await toArray(resultStream3); // output3 would be [0]
