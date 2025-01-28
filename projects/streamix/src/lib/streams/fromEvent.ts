import { Consumer, createEmission, createStream, flags, internals, Stream, Subscription } from '../abstractions';

export function fromEvent<T = any>(target: EventTarget, eventName: string): Stream<T> {
  let listener!: (event: Event) => void;

  const stream = createStream<T>('fromEvent', async function(this: Stream<T>): Promise<void> {
    // Wait for completion
    await this[internals].awaitCompletion();

    target.removeEventListener(eventName, listener);
  });

  const newStream: any = function(this: Stream<T>, c: Consumer): Subscription {

    if (!listener) {
      listener = async (event: Event) => {
        if (this[flags].isRunning) {
          // Emit the event to the stream
          c.next(createEmission({ value: event }));
        }
      }

      // Add the event listener to the target
      target.addEventListener(eventName, listener);
    }

    return this(c);
  };

  Object.defineProperty(newStream, 'name', { writable: true, enumerable: true, configurable: true });
  Object.assign(newStream, stream);
  newStream.subscribe = newStream;
  return newStream as unknown as Stream<T>;
}
