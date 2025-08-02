import { Stream } from '../abstractions';
import { loop } from './loop';

/**
 * Creates a stream that emits a sequence of numbers, starting from `start`,
 * incrementing by `step`, and emitting `count` values.
 *
 * - Similar to `Array.from({ length: count }, (_, i) => start + i * step)` but as a stream.
 * - Useful for generating numerical sequences in reactive flows.
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
