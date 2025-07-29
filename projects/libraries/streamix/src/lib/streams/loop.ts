import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream that emits values in a loop using a `condition` and `iterateFn`.
 *
 * - Starts with `initialValue`.
 * - Emits values while `condition(currentValue)` returns `true`.
 * - Uses `iterateFn(currentValue)` to calculate the next value.
 * - Supports cancellation via `unsubscribe()`.
 */
export function loop<T>(
  initialValue: T,
  condition: (value: T) => boolean,
  iterateFn: (value: T) => T
): Stream<T> {
  let currentValue = initialValue;

  // Create the stream with a custom run function using a generator
  return createStream<T>('loop', async function* (this: Stream<T>): AsyncGenerator<T> {
    // Loop while condition is true and the stream is not completed
    while (condition(currentValue)) {
      // Create and yield the emission for the current value
      yield currentValue;

      // Update the value using the iterate function
      currentValue = iterateFn(currentValue);
    }
  });
}
