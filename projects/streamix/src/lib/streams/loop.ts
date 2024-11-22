import { createEmission, Emission } from '../abstractions';
import { createStream, Stream } from '../abstractions';
import { eventBus } from '../abstractions';

export function loop<T>(
  initialValue: T,
  condition: (value: T) => boolean,
  iterateFn: (value: T) => T
): Stream<T> {
  let currentValue = initialValue;

  // Create the stream with a custom run function
  const stream = createStream<T>(async function(this: Stream<T>) {
    while (condition(currentValue) && !this.shouldComplete()) {
      const emission = createEmission({ value: currentValue }) as Emission;

      // Emit the current value
      this.emissionCounter++;
      eventBus.enqueue({ target: this, payload: { emission, source: this }, type: 'emission' });

      // Apply the iterateFn to get the next value
      currentValue = iterateFn(currentValue);

      if(eventBus.harmonize) {
        await emission.wait()
      }
    }

    // If the condition fails, complete the stream
    if (!this.shouldComplete()) {
      this.isAutoComplete = true;
    }
  });

  stream.name = "loop";
  return stream;
}
