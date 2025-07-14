import { Stream } from '../abstractions';
import { timer } from './timer';

/**
 * Creates a stream that emits incremental numbers starting from 0
 * at a regular interval specified in milliseconds.
 *
 * Uses the `timer` function with initial delay 0 and the given interval.
 */
export function interval(intervalMs: number): Stream<number> {
  // Use the timer function to create a stream that emits at the specified interval
  const stream = timer(0, intervalMs);

  stream.name = 'interval';
  return stream;
}
