import { createStream, Stream } from '../abstractions';

export function of<T = any>(value: T): Stream<T> {
  // Create the custom run function for the OfStream
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    try {
      if (!this.shouldComplete()) {
        await this.onEmission.parallel({ emission: { value }, source: this });
        this.isAutoComplete = true; // Set auto-complete after emitting the value
      }
    } catch (error) {
      await this.onError.parallel({ error }); // Handle any errors during emission
    }
  });


  stream.name = "of";
  // Create the stream using createStream and the custom run function
  return stream;
}
