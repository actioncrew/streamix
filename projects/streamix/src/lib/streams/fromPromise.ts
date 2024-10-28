import { Stream } from '../abstractions/stream';
import { createStream } from '../abstractions/stream';

// Function to create a FromPromiseStream
export function fromPromise<T = any>(promise: Promise<T>): Stream<T> {
  // Create a custom run function for the FromPromiseStream
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    let resolvedValue: Awaited<T> | void; // Renamed to avoid conflict
    let isResolved = false;

    try {
      // Await the promise directly
      resolvedValue = await Promise.race([
        promise,
        this.awaitCompletion() // Allow the stream to complete while waiting
      ]);

      // Set the resolved flag to true
      isResolved = true;

      // If the stream is not complete, emit the value
      if (!this.shouldComplete()) {
        await this.onEmission.parallel({ emission: { value: resolvedValue }, source: this });
        this.isAutoComplete = true; // Mark the stream for auto completion
      }
    } catch (error) {
      await this.onError.parallel({ error }); // Handle any errors
    }
  });


  stream.name = "fromPromise";
  // Create and return the FromPromiseStream using createStream
  return stream;
}
