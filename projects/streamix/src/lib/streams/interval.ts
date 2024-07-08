import { AbstractStream } from '../abstractions/stream';

export class IntervalStream extends AbstractStream {
  private intervalMs: number;
  private intervalId: any | null;
  private currentValue: number;

  constructor(intervalMs: number) {
    super();
    this.intervalMs = intervalMs;
    this.intervalId = null;
    this.currentValue = 0;
  }

  run(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.intervalId = setInterval(() => {
        this.emit({ value: this.currentValue++ });
      }, this.intervalMs);

      this.unsubscribe = () => {
        if (this.intervalId) {
          clearInterval(this.intervalId);
          resolve();
        }
      };
    });
  }
}

export function interval(intervalMs: number) {
  return new IntervalStream(intervalMs);
}
