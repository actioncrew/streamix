import { Stream, Subscription } from '../abstractions';
import { createStream } from '../abstractions/stream';
import { counter } from '../utils';

// Function to create a FromEventStream
export function fromEvent<T = any>(target: EventTarget, eventName: string): Stream<T> {
  // Create a custom run function for the FromEventStream
  const stream = createStream<T>(async (): Promise<void> => {
    const eventCounter = counter(0); // To track event processing
    const listener = async (event: Event) => {
      if (stream.isRunning) {
        eventCounter.increment();
        await stream.onEmission.process({ emission: { value: event }, source: stream });
        eventCounter.decrement();
      }
    };

    // Add the event listener to the target
    target.addEventListener(eventName, listener);

    try {
      // Wait for the stream to complete or be stopped
      await stream.awaitCompletion();
    } finally {
      // Remove the event listener when the stream is complete or stopped
      target.removeEventListener(eventName, listener);
    }
  });

  // Create and return the FromEventStream using createStream
  return stream;
}
