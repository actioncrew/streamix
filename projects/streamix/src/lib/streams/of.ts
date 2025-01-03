import { createEmission, createStream, flags, internals, Stream } from '../abstractions';

export function of<T = any>(value: T): Stream<T> {
  // Create the custom run function for the OfStream
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    try {
      if (!this[internals].shouldComplete()) {
        this.next(createEmission({ value }));
        this[flags].isAutoComplete = true;
      }
    } catch (error) {
      this.error(error);
    }
  });


  stream.name = "of";
  // Create the stream using createStream and the custom run function
  return stream;
}
