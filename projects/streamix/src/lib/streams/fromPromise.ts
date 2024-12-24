import { internals } from './../abstractions/subscribable';
import { Stream, createEmission, createStream } from '../abstractions';
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
      }
    } catch (error) {
      eventBus.enqueue({ target: this, payload: { error, source: this }, type: 'error' });
    }
  });


  stream.name = "fromPromise";
  return stream;
}
