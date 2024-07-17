import { AbstractStream } from '../abstractions/stream';

export class OfStream extends AbstractStream {
  private readonly value: any;
  private emitted: boolean = false;

  constructor(value: any) {
    super();
    this.value = value;
  }

  override async run(): Promise<void> {
    if (!this.emitted && !this.isUnsubscribed.value && !this.isCancelled.value) {
      await super.emit({ value: this.value });
      this.emitted = true;
    }
    if(!this.isUnsubscribed.value && !this.isCancelled.value) {
      this.isAutoComplete.resolve(true);
    }
  }
}

export function of(value: any) {
  return new OfStream(value);
}
