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

  override async run(): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        this.emit({ value: this.value }).then(() => {
          this.intervalId = setInterval(() => {
            this.value++;
            this.emit({ value: this.value });
          }, this.intervalMs);
        });
      }, this.delayMs);

       // Listen for the stop request
       this.isStopRequested.then(() => {
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
        resolve();
      });

      this.unsubscribe = () => {
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
        resolve();
        if(this.isUnsubscribed.value === true) {
          this.isStopRequested.resolve(true);
        }
      };
    });
  }
}

export function timer(delayMs: number, interval: number) {
  return new TimerStream(delayMs, interval);
}
