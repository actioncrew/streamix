import { Stream } from '../abstractions';
import { timer } from './timer';

export function interval(intervalMs: number): Stream<number> {
  const stream = timer(0, intervalMs);
  stream.name = "interval";
  return stream;
}
