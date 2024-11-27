import { internals } from './../abstractions/subscribable';
import { Stream, createEmission, createStream, flags, hooks } from '../abstractions';
import { eventBus } from '../abstractions';

// Function to create a FromPromiseStream
export function fromPromise<T = any>(promise: Promise<T>): Stream<T> {
  // Create a custom run function for the FromPromiseStream
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    let resolvedValue: Awaited<T> | void; // Renamed to avoid conflict

    try {
      // Await the promise directly
      resolvedValue = await Promise.race([
        promise,
        this[internals].awaitCompletion() // Allow the stream to complete while waiting
      ]);

      // If the stream is not complete, emit the value
      if (!this[internals].shouldComplete()) {
        eventBus.enqueue({ target: this, payload: { emission: createEmission({ value: resolvedValue }), source: this }, type: 'emission' });

        // Set the completion flag to true
        this[flags].isAutoComplete = true;
      }
    } catch (error) {
      eventBus.enqueue({ target: this, payload: { emission: createEmission({ error, failed: true }), source: this }, type: 'emission' });
    }
  });


  stream.name = "fromPromise";
  // Create and return the FromPromiseStream using createStream
  return stream;
}
