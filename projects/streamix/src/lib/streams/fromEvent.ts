import { createEmission, createStream, Stream, Subscription } from '../abstractions';

export function fromEvent<T = any>(target: EventTarget, eventName: string): Stream<T> {
  let listener!: (event: Event) => void;
  let subscription!: Subscription;

  // Create the stream using createStream
  const stream = createStream<T>('fromEvent', async function(this: Stream<T>): Promise<void> {
    // Wait for completion
    await this.awaitCompletion();

    // Clean up listener when stream completes
    target.removeEventListener(eventName, listener);
  });

  // Override the subscribe method to handle adding event listeners
  const originalSubscribe = stream.subscribe.bind(stream);

  const newStream: any = function(params?: any): Subscription {
    // Ensure that the listener is added only once
    if (!listener) {
      listener = (event: Event) => {
        if (newStream.isRunning) {
          // Emit the event to the stream
          newStream.next(createEmission({ value: event }));
        }
      };

      // Add the event listener to the target
      target.addEventListener(eventName, listener);
    }

    Object.setPrototypeOf(newStream, stream);

    // Call the original subscribe method
    subscription = originalSubscribe(params);
    return subscription;
  };

  // Ensure we return a stream type
  return newStream as unknown as Stream<T>;
}
