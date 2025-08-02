import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream that emits values in a loop based on a condition and an
 * iteration function.
 *
 * This operator is useful for generating a sequence of values until a specific
 * condition is no longer met. It starts with an `initialValue` and, for each
 * iteration, it yields the current value and then uses `iterateFn` to
 * calculate the next value in the sequence.
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
