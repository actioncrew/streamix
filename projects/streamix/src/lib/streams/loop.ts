import { Emission } from '../abstractions';
import { createStream, Stream } from '../abstractions/stream';

export function loop<T>(
  initialValue: T,
  condition: (value: T) => boolean,
  iterateFn: (value: T) => T
): Stream<T> {
  let currentValue = initialValue;

  // Create the stream with a custom run function
  const stream = createStream<T>(async function(this: Stream<T>) {
    while (condition(currentValue) && !this.shouldComplete()) {
      const emission = { value: currentValue } as Emission;

      // Emit the current value
      await this.onEmission.parallel({ emission, source: this });

      // Apply the iterateFn to get the next value
      currentValue = iterateFn(currentValue);
    }

    // If the condition fails, complete the stream
    if (!this.shouldComplete()) {
      this.isAutoComplete = true; // Mark the stream for auto-completion
    }
  });

  stream.name = "loop";
  return stream;
}
