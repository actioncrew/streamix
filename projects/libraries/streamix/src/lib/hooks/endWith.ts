import { createMapper, Stream, StreamMapper, Subscription } from '../abstractions';
import { createSubject, Subject } from '../streams';

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
  const operator = (input: Stream<T>, output: Subject<T>) => {
    let subscription: Subscription | null = null;

    // Subscribe to the input stream
    subscription = input.subscribe({
      next: (value) => {
        // Forward values from the input stream to the output stream
        output.next(value);
      },
      error: (err) => {
        // Propagate error from the input stream to the output stream
        output.error(err);
      },
      complete: () => {
        subscription?.unsubscribe();
        // After the input stream completes, emit the endValue and complete the stream
        output.next(endValue);
        output.complete();
      },
    });
  };

  // Return the operator wrapped in createMapper for use in the pipe
  return createMapper('endWith', createSubject<T>(), operator);
};

