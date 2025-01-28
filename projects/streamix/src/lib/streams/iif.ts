import { Consumer, createStream, flags, internals, Stream, Subscription } from '../abstractions';
import { Emission } from './../abstractions/emission';

export function iif<T>(
  condition: () => boolean, // Evaluate condition once at initialization
  trueStream: Stream<T>, // Stream to choose when condition is true
  falseStream: Stream<T> // Stream to choose when condition is false
): Stream<T> {
  let selectedStream: Stream<T> | undefined;
  let subscription!: Subscription;

  // Create and return the stream with the defined run function
  const stream = createStream<T>('iif', async function(this: Stream<T>, c: Consumer): Promise<void> {
    // Choose the appropriate stream based on the condition
    selectedStream = condition() ? trueStream : falseStream;

    // Start the selected stream
    subscription = selectedStream({
      next: async (emission: Emission) => {
        c.next(emission);
      },
      complete: () => this[flags].isAutoComplete = true
    });

    // Wait for the completion of the selected stream
    await this[internals].awaitCompletion();

    subscription.unsubscribe();
  });

  return stream;
}
