import { createEmission, createStream, flags, Stream, Subscription } from '../abstractions';

export function iif<T>(
  condition: () => boolean, // Evaluate condition once at initialization
  trueStream: Stream<T>, // Stream to choose when condition is true
  falseStream: Stream<T> // Stream to choose when condition is false
): Stream<T> {
  let selectedStream: Stream<T> | undefined;
  let subscription!: Subscription;

  // Create and return the stream with the defined run function
  const stream = createStream<T>('iif', async function(this: Stream<T>): Promise<void> {
    // Choose the appropriate stream based on the condition
    selectedStream = condition() ? trueStream : falseStream;

    // Start the selected stream
    subscription = selectedStream({
      next: (value) => handleEmission(this, value),
      complete: () => this[flags].isAutoComplete = true
    });

    // Wait for the completion of the selected stream
    await this.awaitCompletion();

    subscription.unsubscribe();
  });

  // Handle emissions from the selected stream
  const handleEmission = async (stream: Stream<T>, value: T): Promise<void> => {
    if (!stream.shouldComplete()) {
      stream.next(createEmission({ value }));
    }
  };

  return stream;
}
