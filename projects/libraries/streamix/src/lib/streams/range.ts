import { PipelineContext, Stream } from '../abstractions';
import { loop } from './loop';

/**
 * Creates a stream that emits a sequence of numbers, starting from `start`,
 * incrementing by `step`, and emitting a total of `count` values.
 *
 * This operator is a powerful way to generate a numerical sequence in a
 * reactive sc?. It's similar to a standard `for` loop but produces
 * values as a stream. It's built upon the `loop` operator for its
 * underlying logic.
 *
 * @param {number} start - The first number to emit in the sequence.
 * @param {number} count - The total number of values to emit. Must be a non-negative number.
 * @param {number} [step=1] - The amount to increment or decrement the value in each step.
 * @returns {Stream<number>} A stream that emits a sequence of numbers.
 */
export function range(start: number, count: number, step: number = 1, context?: PipelineContext): Stream<number> {
  const end = start + count * step;
  const stream = loop(
    start,
    current => (step > 0 ? current < end : current > end),
    current => current + step,
    context
  );

  stream.name = 'range';
  return stream;
}
