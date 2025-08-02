import { Stream } from '../abstractions';
import { loop } from './loop';

/**
 * Creates a stream that emits a sequence of numbers, starting from `start`,
 * incrementing by `step`, and emitting a total of `count` values.
 *
 * This operator is a powerful way to generate a numerical sequence in a
 * reactive context. It's similar to a standard `for` loop but produces
 * values as a stream. It's built upon the `loop` operator for its
 * underlying logic.
 */
export function range(start: number, count: number, step: number = 1): Stream<number> {
  const end = start + count * step;
  const stream = loop(
    start,
    current => (step > 0 ? current < end : current > end),
    current => current + step
  );

  stream.name = 'range';
  return stream;
}
