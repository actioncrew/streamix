import { Stream } from '../abstractions/stream';
import { Subscription } from '../abstractions/subscription';

export class TimerStream<T = any> extends Stream<T> {
  private delayMs: number;
  private intervalId: any;
  private intervalMs: number;
  private value: number;
  private resolvePromise: ((value: void | PromiseLike<void>) => void) | null = null;

  constructor(delayMs: number, intervalMs: number) {
    super();
    this.delayMs = delayMs;
    this.intervalMs = intervalMs;
    this.intervalId = null;
    this.value = 0;
  }

  override async run(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.resolvePromise = resolve;

      setTimeout(() => {
        this.onEmission.process({ emission: { value: this.value }, next: this.head! }).then(() => {
          this.intervalId = setInterval(() => {
            this.value++;
            this.onEmission.process({ emission: { value: this.value }, next: this.head! });
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
        if (!this.subscribers.hasCallbacks()) {
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

export function timer(delayMs: number, interval: number) {
  return new TimerStream(delayMs, interval);
}
