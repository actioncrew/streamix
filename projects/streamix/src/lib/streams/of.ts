import { createStream, Stream } from '../abstractions';

export function of<T = any>(value: T): Stream<T> {
  // Create the custom run function for the OfStream
  const stream = createStream<T>(async (): Promise<void> => {
    try {
      if (!stream.shouldComplete()) {
        await stream.onEmission.process({ emission: { value }, source: stream });
        stream.isAutoComplete = true; // Set auto-complete after emitting the value
      }
    } catch (error) {
      await stream.onError.process({ error }); // Handle any errors during emission
    }
  });

  // Create the stream using createStream and the custom run function
  return stream;
}
