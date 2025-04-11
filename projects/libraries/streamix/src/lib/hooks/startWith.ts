import { createMapper, Stream, StreamMapper, Subscription } from '../abstractions'; // Adjust path as needed
import { createSubject, Subject } from '../streams';
/**
 * Creates a stream mapper that prepends a specified initial value
 * to the sequence emitted by the source stream, using an async generator.
 *
 * @template T The type of the initial value.
 * @param initialValue The value to emit first.
 * @returns A StreamMapper function that transforms an input Stream<T> into an output Stream<T>.
 */
export const startWith = <T = any>(startValue: T): StreamMapper => {
  const operator = (input: Stream<T>, output: Subject<T>) => {
    let subscription: Subscription | null = null;

    // Emit the startValue immediately
    output.next(startValue);

    // Subscribe to the input stream and forward its values to the output stream
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
        // Complete the output stream once the input stream completes
        output.complete();
      },
    });
  };

  // Return the operator wrapped in createMapper for use in the pipe
  return createMapper('startWith', createSubject<T>(), operator);
};
