import { createEmission, createStream, flags, internals, Stream } from '../abstractions';

export function fromEvent<T = any>(target: EventTarget, eventName: string): Stream<T> {
  let listener!: (event: Event) => void;

  // Create the stream using createStream
  const stream = createStream<T>('fromEvent', async function(this: Stream<T>): Promise<void> {
    listener = async (event: Event) => {
      if (this[flags].isRunning) {
        this.next(createEmission({ value: event }));
      }
    };

    target.addEventListener(eventName, listener);

    await this[internals].awaitCompletion();

    target.removeEventListener(eventName, listener);
  });

  return stream;
}
