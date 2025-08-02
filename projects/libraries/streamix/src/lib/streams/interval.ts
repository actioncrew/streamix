import { Stream } from '../abstractions';
import { timer } from './timer';

/**
 * Creates a stream that emits incremental numbers starting from 0 at a regular
 * interval.
 *
 * This operator is a shorthand for `timer(0, intervalMs)`, useful for
 * creating a simple, repeating sequence of numbers. The stream emits a new
 * value every `intervalMs` milliseconds.
 */
export function interval(intervalMs: number): Stream<number> {
  // Use the timer function to create a stream that emits at the specified interval
  const stream = timer(0, intervalMs);

  stream.name = 'interval';
  return stream;
}
