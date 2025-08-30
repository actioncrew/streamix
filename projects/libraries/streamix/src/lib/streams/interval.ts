import { PipelineContext, Stream } from '../abstractions';
import { timer } from './timer';

/**
 * Creates a stream that emits incremental numbers starting from 0 at a regular
 * interval.
 *
 * This operator is a shorthand for `timer(0, intervalMs)`, useful for
 * creating a simple, repeating sequence of numbers. The stream emits a new
 * value every `intervalMs` milliseconds. It is analogous to `setInterval` but
 * as an asynchronous stream.
 *
 * @param {number} intervalMs The time in milliseconds between each emission.
 * @returns {Stream<number>} A stream that emits incrementing numbers (0, 1, 2, ...).
 */
export function interval(intervalMs: number, context?: PipelineContext): Stream<number> {
  // Use the timer function to create a stream that emits at the specified interval
  const stream = timer(0, intervalMs, context);

  stream.name = 'interval';
  return stream;
}
