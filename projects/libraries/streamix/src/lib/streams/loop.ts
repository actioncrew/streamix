import { createStream, Stream } from '../abstractions';

export function loop<T>(
  initialValue: T,
  condition: (value: T) => boolean,
  iterateFn: (value: T) => T
): Stream<T> {
  let currentValue = initialValue;

  // Create the stream with a custom run function using a generator
  const stream = createStream<T>('loop', async function* (this: Stream<T>): AsyncGenerator<T> {
    // Loop while condition is true and the stream is not completed
    while (condition(currentValue) && !this.completed()) {
      // Create and yield the emission for the current value
      yield currentValue;

      // Update the value using the iterate function
      currentValue = iterateFn(currentValue);
    }
  });

  return stream;
}
