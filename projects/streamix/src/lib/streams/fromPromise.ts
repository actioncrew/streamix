import { Stream, createStream } from '../abstractions';
import { eventBus } from './bus';

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
        eventBus.enqueue({ target: this, payload: { emission: { value: resolvedValue }, source: this }, type: 'emission' });
        this.isAutoComplete = true; // Mark the stream for auto completion
      }
    } catch (error) {
      eventBus.enqueue({ target: this, payload: { emission: { error, isFailed: true }, source: this }, type: 'emission' });
    }
  });


  stream.name = "fromPromise";
  // Create and return the FromPromiseStream using createStream
  return stream;
}
