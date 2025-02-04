import { createStream, Stream } from '../abstractions';
import { createSubject } from './subject';

export function iif<T>(
  condition: () => boolean, // Evaluate condition once at initialization
  trueStream: Stream<T>, // Stream to choose when condition is true
  falseStream: Stream<T> // Stream to choose when condition is false
): Stream<T> {
  let selectedStream: Stream<T> | undefined;
  const subject = createSubject<T>(); // Create a subject to forward emissions

  // Create and return the stream with the defined run function
  const stream = createStream<T>('iif', async function*(this: Stream<T>) {
    // Choose the appropriate stream based on the condition
    selectedStream = condition() ? trueStream : falseStream;

    // Subscribe to the selected stream and forward emissions to the subject
    const subscription = selectedStream.subscribe({
      next: (value: T) => {
        // Forward the value from the selected stream to the subject
        subject.next(value);
      },
      complete: () => {
        // Mark the stream as completed once the selected stream completes
        subject.complete(); // Complete the subject
        subscription.unsubscribe();
      }
    });
  });

  return stream;
}
