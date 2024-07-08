import { AbstractStream } from '../abstractions/stream';

export class TimerStream extends AbstractStream {
  private delayMs: number;
  private timeoutId: any | null;

  constructor(delayMs: number) {
    super();
    this.delayMs = delayMs;
    this.timeoutId = null;
  }

  run(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.timeoutId = setTimeout(() => {
        this.emit({ value: 0 }).then(() => {
          this.isAutoComplete = true; // Mark the stream as finished after emitting
          resolve();
        });
      }, this.delayMs);

      this.unsubscribe = () => {
        if (this.timeoutId) {
          clearTimeout(this.timeoutId);
          this.timeoutId = null;
          this.isUnsubscribed.resolve(true);
          resolve();
        }
      };
    });
  }
}

export function timer(delayMs: number) {
  return new TimerStream(delayMs);
}
