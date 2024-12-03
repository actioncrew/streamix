import { Emission } from '../abstractions';
import { Stream } from '../abstractions/stream';

export class RangeStream<T = any> extends Stream<T> {
  private current: number;

  constructor(private readonly startValue: number, private readonly endValue: number, private readonly step: number = 1) {
    super();
    this.current = startValue;
  }

  async run(): Promise<void> {
    try {
      while (this.current < this.endValue && !this.shouldComplete()) {
        let emission = { value: this.current } as Emission;
        await this.onEmission.parallel({ emission, source: this });

        if (emission.failed) {
          throw emission.error;
        }

        this.current += this.step;
      }
      if (this.current >= this.endValue && !this.shouldComplete()) {
        this.isAutoComplete = true;
      }
    } catch (error) {
      await this.onError.parallel({ error });
    }
  }
}

export function range<T = any>(start: number, end: number, step: number = 1) {
  return new RangeStream<T>(start, end, step);
}
