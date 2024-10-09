import { TimerStream } from './timer';

export class IntervalStream extends TimerStream {
  constructor(intervalMs: number) {
    super(0, intervalMs);
  }
}

export function interval(intervalMs: number) {
  return new IntervalStream(intervalMs);
}
