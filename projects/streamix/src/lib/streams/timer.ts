import { Stream } from '../abstractions/stream';

export class TimerStream extends Stream<number> {
  private timerValue: number = 0;
  private timeoutId: any | undefined;
  private intervalId: any | undefined;

  constructor(private readonly delayMs: number = 0, private intervalMs?: number) {
    super();
    this.intervalMs = intervalMs ?? delayMs;
  }

  async run(): Promise<void> {
    try {
      if (await this.initialDelay()) {
        return; // Stream was completed during the delay
      }

      await this.emitValue();

      if (this.intervalMs !== undefined && this.intervalMs > 0) {
        await this.startInterval();
      } else {
        this.isAutoComplete = true;
      }
    } catch (error) {
      await this.onError.parallel({ error });
    } finally {
      this.finalize();
    }
  }

  private async initialDelay(): Promise<boolean> {
    if (this.delayMs === 0) {
      return this.shouldComplete();
    }

    return new Promise<boolean>((resolve) => {
      this.timeoutId = setTimeout(() => {
        this.timeoutId = undefined;
        resolve(this.shouldComplete());
      }, this.delayMs);
    });
  }

  private async emitValue(): Promise<void> {
    if (this.shouldComplete()) {
      return;
    }
    await this.onEmission.parallel({ emission: { value: this.timerValue }, source: this });
    this.timerValue++;
  }

  private startInterval(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.intervalId = setInterval(async () => {
        try {
          if (this.shouldComplete()) {
            this.finalize();
            resolve();
            return;
          }
          await this.emitValue();
        } catch (error) {
          this.onError.parallel({ error });
          this.finalize();
          resolve();
        }
      }, this.intervalMs);
    });
  }

  private finalize() {
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
    this.finalize();
    return super.complete();
  }
}

export function timer(delayMs: number = 0, intervalMs?: number): TimerStream {
  return new TimerStream(delayMs, intervalMs);
}
