import { Stream } from '../abstractions';
import { timer } from './timer';

export function interval(intervalMs: number): Stream<number> {
  return timer(0, intervalMs);
}
