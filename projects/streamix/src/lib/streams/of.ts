import { createEmission, createStream, Stream } from '../abstractions';

export function of<T = any>(value: T): Stream<T> {
  // Create the custom run function for the OfStream
  const stream = createStream<T>('of', async function(this: Stream<T>): Promise<void> {
    try {
      if (!this.shouldComplete()) {
        this.next(createEmission({ value }));
        this.isAutoComplete = true;
      }
    } catch (error) {
      this.error(error);
    }
  });

  // Create the stream using createStream and the custom run function
  return stream;
}
