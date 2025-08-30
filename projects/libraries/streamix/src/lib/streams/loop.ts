import { createStream, PipelineContext, Stream } from '../abstractions';

/**
 * Creates a stream that emits values in a loop based on a condition and an
 * iteration function.
 *
 * This operator is useful for generating a sequence of values until a specific
 * condition is no longer met. It starts with an `initialValue` and, for each
 * iteration, it yields the current value and then uses `iterateFn` to
 * calculate the next value in the sequence.
 *
 * @template T The type of the values in the stream.
 * @param {T} initialValue The starting value for the loop.
 * @param {(value: T) => boolean} condition A function that returns `true` to continue the loop and `false` to stop.
 * @param {(value: T) => T} iterateFn A function that returns the next value in the sequence.
 * @returns {Stream<T>} A stream that emits the generated sequence of values.
 */
export function loop<T = any>(
  initialValue: T,
  condition: (value: T) => boolean,
  iterateFn: (value: T) => T,
  context?: PipelineContext
): Stream<T> {
  let currentValue = initialValue;

  return createStream<T>(
    'loop',
    async function* (): AsyncGenerator<T, void, unknown> {
      while (condition(currentValue)) {
        yield currentValue;
        currentValue = iterateFn(currentValue);
      }
    },
    context
  );
}
