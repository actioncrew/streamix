import { Stream } from '../abstractions/stream';

export class TimerStream extends Stream<number> {
  private delayMs: number;
  private intervalMs: number;
  private value: number = 0;
  private timeoutId: any | undefined;
  private intervalId: any | undefined;

  constructor(delayMs: number = 0, intervalMs?: number) {
    super();
    this.delayMs = delayMs;
    this.intervalMs = intervalMs ?? delayMs;
  }

  override async run(): Promise<void> {
    try {
      if (await this.initialDelay()) {
        return; // Stream was completed or terminated during the delay
      }

      await this.emitValue();

      if (this.intervalMs > 0) {
        await this.startInterval();
      } else {
        this.isAutoComplete.resolve(true);
      }
    } catch (error) {
      await this.handleError(error);
    } finally {
      this.cleanup();
    }
  }

  private async initialDelay(): Promise<boolean> {
    if (this.delayMs === 0) {
      return this.shouldComplete() || this.shouldTerminate();
    }

    return new Promise<boolean>((resolve) => {
      this.timeoutId = setTimeout(() => {
        this.timeoutId = undefined;
        resolve(this.shouldComplete() || this.shouldTerminate());
      }, this.delayMs);
    });
  }

  private async emitValue(): Promise<void> {
    if (this.shouldComplete() || this.shouldTerminate()) {
      return;
    }
    await this.onEmission.process({ emission: { value: this.value }, source: this });
    this.value++;
  }

  private startInterval(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.intervalId = setInterval(async () => {
        try {
          if (this.shouldComplete() || this.shouldTerminate()) {
            this.cleanup();
            resolve();
            return;
          }
          await this.emitValue();
        } catch (error) {
          this.handleError(error);
          this.cleanup();
          resolve();
        }
      }, this.intervalMs);
    });
  }

  private cleanup(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  override async complete(): Promise<void> {
    this.cleanup();
    return super.complete();
  }

  override async terminate(): Promise<void> {
    this.cleanup();
    return super.terminate();
  }
}

export function timer(delayMs: number = 0, intervalMs?: number): TimerStream {
  return new TimerStream(delayMs, intervalMs);
}
