import { Stream } from '../abstractions/stream';

export class OfStream<T = any> extends Stream<T> {
  private readonly value: T;
  private emitted: boolean = false;

  constructor(value: any) {
    super();
    this.value = value;
  }

  override async run(): Promise<void> {
    if (!this.emitted && !this.shouldComplete() && !this.shouldTerminate()) {
      await this.onEmission.process({ emission: { value: this.value }, source: this });
      this.emitted = true;
    }
    if(this.emitted) {
      this.isAutoComplete.resolve(true);
    }
  }
}

export function of<T = any>(value: T) {
  return new OfStream<T>(value);
}
