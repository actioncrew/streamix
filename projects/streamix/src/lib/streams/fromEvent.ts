import { createEmission, createStream, flags, internals, Stream, Subscription } from '../abstractions';

export function fromEvent<T = any>(target: EventTarget, eventName: string): Stream<T> {
  let listener!: (event: Event) => void;

  const run = async function(this: Stream<T>): Promise<void> {
    // Wait for completion
    await this[internals].awaitCompletion();

    target.removeEventListener(eventName, listener);
  };

  // Create the stream using createStream
  const stream = createStream<T>('fromEvent', run);
  const originalSubscribe = stream.subscribe.bind(stream); // Store the original start method

  const newStream: any = function(params?: any): Subscription {
    // Call the original start method
    let subscription = originalSubscribe(params);

    if (!listener) {
      listener = async function(event: Event) {
        if (newStream[flags].isRunning) {
          // Emit the event to the stream
          newStream.next(createEmission({ value: event }));
        }
      }

      // Add the event listener to the target
      target.addEventListener(eventName, listener);
    }

    return subscription;
  };

  Object.defineProperty(newStream, 'name', { writable: true, enumerable: true, configurable: true });
  Object.assign(newStream, stream);
  newStream.subscribe = newStream;
  return newStream as unknown as Stream<T>;
}
