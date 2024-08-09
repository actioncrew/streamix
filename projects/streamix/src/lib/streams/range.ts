import { Emission } from '../abstractions';
import { Stream } from '../abstractions/stream';

export class RangeStream extends Stream {
  private current: number;
  private end: number;
  private step: number;

  constructor(start: number, end: number, step: number = 1) {
    super();
    this.current = start;
    this.end = end;
    this.step = step;
  }

  override async run(): Promise<void> {
    try {
      while (this.current < this.end && !this.isStopRequested()) {
        let emission = { value: this.current } as Emission;
        await this.onEmission.process({ emission, next: this.head! });

        if (emission.isFailed) {
          throw emission.error;
        }

        this.current += this.step;
      }
      if (!this.isStopRequested()) {
        this.isAutoComplete.resolve(true);
      }
    } catch (error) {
      this.isFailed.resolve(error);
    }
  }
}

export function range(start: number, end: number, step: number = 1) {
  return new RangeStream(start, end, step);
}
