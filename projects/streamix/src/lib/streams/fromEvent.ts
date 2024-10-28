import { Stream, Subscription } from '../abstractions';
import { counter } from '../utils';
import { createStream } from '../abstractions/stream';

export function fromEvent<T = any>(target: EventTarget, eventName: string): Stream<T> {
  let eventCounter = counter(0);
  let listener!: (event: Event) => void;

  const run = async function(this: Stream<T>): Promise<void> {
    // Clean up the event listener on completion
    this.onStop.once(() => {
      target.removeEventListener(eventName, listener);
    });

    // Wait for completion
    await this.awaitCompletion();
  };

  // Create the stream using createStream
  const stream = createStream<T>(run);
  const originalSubscribe = stream.subscribe.bind(stream); // Store the original start method

  stream.subscribe = function(this: Stream<T>, params?: any): Subscription {
    if (!listener) {
      listener = async (event: Event) => {
        if (this.isRunning) {
          eventCounter.increment();
          // Emit the event to the stream
          await this.onEmission.parallel({ emission: { value: event }, source: this });
          eventCounter.decrement();
        }
      };

      // Add the event listener to the target
      target.addEventListener(eventName, listener);
    }

    // Call the original start method
    return originalSubscribe(params);
  };

  stream.name = "fromEvent";
  return stream;
}
