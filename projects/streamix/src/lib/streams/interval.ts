import { Stream } from '../abstractions';
import { timer } from './timer';

export function interval(intervalMs: number): Stream<number> {
  // Use the timer function to create a stream that emits at the specified interval
  const stream = timer(0, intervalMs);

  // Optionally set the name to 'interval'
  stream.name = 'interval';

  return stream;
}
