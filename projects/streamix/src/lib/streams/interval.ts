import { TimerStream } from './timer';

export class IntervalStream<T = any> extends TimerStream<T> {
  constructor(intervalMs: number) {
    super(0, intervalMs);
  }
}

export function interval<T = any>(intervalMs: number) {
  return new IntervalStream<T>(intervalMs);
}
