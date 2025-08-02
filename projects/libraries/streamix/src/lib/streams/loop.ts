import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream that emits values in a loop using a `condition` and `iterateFn`.
 *
 * - Starts with `initialValue`.
 * - Emits values while `condition(currentValue)` returns `true`.
 * - Uses `iterateFn(currentValue)` to calculate the next value.
 * - Supports cancellation via `unsubscribe()`.
 */
export function loop<T = any>(
  initialValue: T,
  condition: (value: T) => boolean,
  iterateFn: (value: T) => T
): Stream<T> {
  let currentValue = initialValue;

  return createStream<T>(
    'loop',
    async function* (this: Stream<T>): AsyncGenerator<T, void, unknown> {
      while (condition(currentValue)) {
        yield currentValue;
        currentValue = iterateFn(currentValue);
      }
    }
  );
}
