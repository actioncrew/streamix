import { createEmission, createStream, Emission, flags, internals, Stream } from '../abstractions';

export function loop<T>(
  initialValue: T,
  condition: (value: T) => boolean,
  iterateFn: (value: T) => T
): Stream<T> {
  let currentValue = initialValue;

  // Create the stream with a custom run function
  const stream = createStream<T>('loop', async function(this: Stream<T>) {

    while (condition(currentValue) && !this[internals].shouldComplete()) {
      const emission = createEmission({ value: currentValue }) as Emission;

      // Emit the current value
      this.next(emission);

      // Apply the iterateFn to get the next value
      currentValue = iterateFn(currentValue);
    }

    // If the condition fails, complete the stream
    if (!this[internals].shouldComplete()) {
      this[flags].isAutoComplete = true;
    }
  });

  return stream;
}
