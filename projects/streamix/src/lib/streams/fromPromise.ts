import { Stream } from '../abstractions/stream';
import { createStream } from '../abstractions/stream';

// Function to create a FromPromiseStream
export function fromPromise<T = any>(promise: Promise<T>): Stream<T> {
  // Create a custom run function for the FromPromiseStream
  const stream = createStream<T>(async (): Promise<void> => {
    let resolvedValue: Awaited<T> | void; // Renamed to avoid conflict
    let isResolved = false;

    try {
      // Await the promise directly
      resolvedValue = await Promise.race([
        promise,
        stream.awaitCompletion() // Allow the stream to complete while waiting
      ]);

      // Set the resolved flag to true
      isResolved = true;

      // If the stream is not complete, emit the value
      if (!stream.shouldComplete()) {
        await stream.onEmission.process({ emission: { value: resolvedValue }, source: stream });
        stream.isAutoComplete = true; // Mark the stream for auto completion
      }
    } catch (error) {
      await stream.onError.process({ error }); // Handle any errors
    }
  });

  // Create and return the FromPromiseStream using createStream
  return stream;
}
