import { Emission } from '../abstractions';
import { AbstractStream } from '../abstractions/stream';

export class FromStream extends AbstractStream {
  private readonly values: any[];
  private index: number = 0;

  constructor(values: any[]) {
    super();
    this.values = values;
  }

  override async run(): Promise<void> {
    while (this.index < this.values.length && !this.isStopRequested.value) {
      let emission = { value: this.values[this.index] } as Emission;
      await this.emit(emission);

      if (emission.isFailed) {
        throw emission.error;
      }

      this.index++;
    }
    if(!this.isStopRequested.value) {
      this.isAutoComplete.resolve(true);
    }
  }
}

export function from(values: any[]) {
  return new FromStream(values);
}
