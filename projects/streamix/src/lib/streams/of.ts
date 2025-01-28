import { Consumer, createEmission, createStream, flags, internals, Stream } from '../abstractions';

export function of<T = any>(value: T): Stream<T> {
  // Create the custom run function for the OfStream
  const stream = createStream<T>('of', async function(this: Stream<T>, c: Consumer): Promise<void> {
    try {
      if (!this[internals].shouldComplete()) {
        c.next(createEmission({ value }));
        this[flags].isAutoComplete = true;
      }
    } catch (error) {
      c.next(createEmission({ error }));
    }
  });

  // Create the stream using createStream and the custom run function
  return stream;
}
