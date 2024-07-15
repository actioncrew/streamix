import { AbstractStream } from '../abstractions/stream';

export class FromStream extends AbstractStream {
  private readonly values: any[];
  private index: number = 0;

  constructor(values: any[]) {
    super();
    this.values = values;
  }

  override async run() {
    try {
      while (this.index < this.values.length && !this.isStopRequested.value) {
        await this.emit({ value: this.values[this.index] });
        this.index++;
      }
      this.isAutoComplete.resolve(true);
    } catch (error) {
      console.error('Error in FromStream:', error);
      this.isFailed.resolve(error);
    } finally {
      this.isStopped.resolve(true);
    }
  }
}

export function from(values: any[]) {
  return new FromStream(values);
}
