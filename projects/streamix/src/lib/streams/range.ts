import { createStream, Stream } from '../abstractions';

export function range<T = any>(start: number, end: number, step: number = 1): Stream<T> {
  // Create the custom run function for the RangeStream
  const run = async (stream: Stream<T>): Promise<void> => {
    let current = start; // Initialize the current value

    try {
      while (current < end && !stream.shouldComplete()) {
        await stream.onEmission.process({ emission: { value: current }, source: stream });

        current += step; // Increment the current value by the step
      }

      // Set auto-completion if we have reached or exceeded the end value
      if (current >= end && !stream.shouldComplete()) {
        stream.isAutoComplete = true;
      }
    } catch (error) {
      await stream.onError.process({ error }); // Handle any errors during emission
    }
  };

  // Create the stream using createStream and the custom run function
  return createStream<T>(run);
}
