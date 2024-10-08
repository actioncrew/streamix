import { Stream } from '../abstractions/stream';
import { Subscription } from '../abstractions/subscription';

export class TimerStream<T = any> extends Stream<T> {
  private delayMs: number;
  private intervalId: any;
  private intervalMs: number;
  private value: number;
  private resolvePromise: ((value: void | PromiseLike<void>) => void) | null = null;

  constructor(delayMs: number = 0, intervalMs?: number) {
    super();
    this.delayMs = delayMs;
    this.intervalMs = intervalMs || delayMs;
    this.intervalId = null;
    this.value = 0;
  }

  override async run(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.resolvePromise = resolve;

      setTimeout(() => {
        this.onEmission.process({ emission: { value: this.value }, source: this }).then(() => {
          this.intervalId = setInterval(() => {
            this.value++;
            this.onEmission.process({ emission: { value: this.value }, source: this });
          }, this.intervalMs);
        });
      }, this.delayMs);

      // Listen for the stop request
      this.isStopRequested.then(() => {
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
        if (this.resolvePromise) {
          this.resolvePromise();
          this.resolvePromise = null;
        }
      });
    });
  }

  override subscribe(callback: (value: T) => any): Subscription {
    let subscription = super.subscribe(callback);

    // Return a subscription object with an unsubscribe method
    return {
      unsubscribe: () => {
        subscription.unsubscribe();
        if (this.subscribers.length === 0) {
          if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
          }
          if (this.resolvePromise) {
            this.resolvePromise();
            this.resolvePromise = null;
          }
        }
      }
    };
  }
}

export function timer<T = any>(delayMs: number = 0, interval?: number) {
  return new TimerStream<T>(delayMs, interval);
}
