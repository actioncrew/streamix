import { createStream, Subscribable, Stream, Subscription } from '../abstractions';
import { Emission } from '../abstractions/emission';

export function iif<T = any>(
  condition: () => boolean, // Evaluate condition once at initialization
  trueStream: Subscribable<T>, // Stream to choose when condition is true
  falseStream: Subscribable<T> // Stream to choose when condition is false
): Stream<T> {
  let selectedStream: Subscribable<T> | undefined;
  let subscription!: Subscription;

  // Create and return the stream with the defined run function
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    // Choose the appropriate stream based on the condition
    selectedStream = condition() ? trueStream : falseStream;

    // Start the selected stream
    subscription = selectedStream.subscribe((value) => handleEmission(this, value));
    selectedStream.onStop.once(() => subscription.unsubscribe());

    // Wait for the completion of the selected stream
    await selectedStream.awaitCompletion();
  });

  // Handle emissions from the selected stream
  const handleEmission = async (stream: Stream<T>, value: T): Promise<void> => {
    if (stream.shouldComplete()) {
      return;
    }

    await stream.onEmission.parallel({
      emission: { value },
      source: stream,
    });
  };

  stream.name = "iif";
  return stream;
}
