import { AbstractStream } from '../abstractions/stream';

export class TimerStream extends AbstractStream {
  private delayMs: number;
  private intervalId: any | null;
  private intervalMs: number;
  private value: number;

  constructor(delayMs: number, intervalMs: number) {
    super();
    this.delayMs = delayMs;
    this.intervalMs = intervalMs;
    this.intervalId = null;
    this.value = 0;
  }

  run(): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        this.emit({ value: this.value }).then(() => {
          this.intervalId = setInterval(() => {
            this.value++;
            this.emit({ value: this.value });
          }, this.intervalMs);
        });
      }, this.delayMs);

      this.unsubscribe = () => {
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
          resolve();
        }
        this.isStopRequested.resolve(true);
        this.isUnsubscribed.resolve(true);
      };
    });
  }
}

export function timer(delayMs: number, interval: number) {
  return new TimerStream(delayMs, interval);
}
