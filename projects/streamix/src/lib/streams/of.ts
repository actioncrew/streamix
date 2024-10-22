import { Stream } from '../abstractions/stream';

export class OfStream<T = any> extends Stream<T> {
  private emitted: boolean = false;

  constructor(private readonly inputValue: T) {
    super();
  }

  async run(): Promise<void> {
    try {
      if (!this.emitted && !this.shouldComplete()) {
        await this.onEmission.process({ emission: { value: this.inputValue }, source: this });
        this.emitted = true;
      }
      if(this.emitted) {
        this.isAutoComplete = true;
      }
    } catch (error) {
      await this.propagateError(error);
    }
  }
}

export function of<T = any>(value: T) {
  return new OfStream<T>(value);
}
