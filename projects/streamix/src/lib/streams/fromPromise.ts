import { Consumer, Stream, createEmission, createStream, internals } from '../abstractions';

// Function to create a FromPromiseStream
export function fromPromise<T = any>(promise: Promise<T>): Stream<T> {
  // Create a custom run function for the FromPromiseStream
  const stream = createStream<T>('fromPromise', async function(this: Stream<T>, c: Consumer): Promise<void> {
    let resolvedValue: Awaited<T> | void; // Renamed to avoid conflict

    try {
      // Await the promise directly
      resolvedValue = await Promise.race([
        promise,
        this[internals].awaitCompletion() // Allow the stream to complete while waiting
      ]);

      // If the stream is not complete, emit the value
      if (!this[internals].shouldComplete()) {
        c.next(createEmission({ value: resolvedValue }));
      }
    } catch (error) {
      c.next(createEmission({ error }));
    }
  });

  return stream;
}
