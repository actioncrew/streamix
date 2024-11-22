import { Stream, createEmission, createStream } from '../abstractions';
import { eventBus } from '../abstractions';

// Function to create a FromPromiseStream
export function fromPromise<T = any>(promise: Promise<T>): Stream<T> {
  // Create a custom run function for the FromPromiseStream
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    let resolvedValue: Awaited<T> | void; // Renamed to avoid conflict
    let isResolved = false;

    this.onComplete.once(() => {
      this.isAutoComplete = true;
    });

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
        stream.emissionCounter++;
        eventBus.enqueue({ target: this, payload: { emission: createEmission({ value: resolvedValue }), source: this }, type: 'emission' });
      }
    } catch (error) {
      eventBus.enqueue({ target: this, payload: { emission: createEmission({ error, failed: true }), source: this }, type: 'emission' });
    }
  });


  stream.name = "fromPromise";
  // Create and return the FromPromiseStream using createStream
  return stream;
}
