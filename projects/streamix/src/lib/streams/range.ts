import { createStream, Stream } from '../abstractions';

export function range<T = any>(start: number, end: number, step: number = 1): Stream<T> {
  // Create the custom run function for the RangeStream
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    let current = start; // Initialize the current value

    try {
      while (current < end && !this.shouldComplete()) {
        await this.onEmission.process({ emission: { value: current }, source: this });

        current += step; // Increment the current value by the step
      }

      // Set auto-completion if we have reached or exceeded the end value
      if (current >= end && !this.shouldComplete()) {
        this.isAutoComplete = true;
      }
    } catch (error) {
      await this.onError.process({ error }); // Handle any errors during emission
    }
  });

  stream.name = "range";
  // Create the stream using createStream and the custom run function
  return stream;
}
