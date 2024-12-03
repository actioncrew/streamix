import { createEmission, flags, hooks, internals, Stream, Subscription } from '../abstractions';
import { createStream } from '../abstractions';
import { eventBus } from '../abstractions';

export function fromEvent<T = any>(target: EventTarget, eventName: string): Stream<T> {
  let listener!: (event: Event) => void;

  const run = async function(this: Stream<T>): Promise<void> {
    // Clean up the event listener on completion
    this[hooks].finalize.once(() => {
      target.removeEventListener(eventName, listener);
    });

    this[hooks].onComplete.once(() => {
      this[flags].isAutoComplete = true;
    });

    // Wait for completion
    await this[internals].awaitCompletion();
  };

  // Create the stream using createStream
  const stream = createStream<T>(run);
  const originalSubscribe = stream.subscribe.bind(stream); // Store the original start method

  stream.subscribe = function(this: Stream<T>, params?: any): Subscription {
    if (!listener) {
      listener = async (event: Event) => {
        if (this[flags].isRunning) {
          // Emit the event to the stream
          eventBus.enqueue({ target: this, payload: { emission: createEmission({ value: event }), source: this }, type: 'emission' });
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
