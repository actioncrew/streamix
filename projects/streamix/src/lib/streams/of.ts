import { AbstractStream } from '../abstractions/stream';

export class OfStream extends AbstractStream {
  private readonly value: any;
  private emitted: boolean = false;

  constructor(value: any) {
    super();
    this.value = value;
  }

  override async run(): Promise<void> {
    if (!this.emitted && !this.isUnsubscribed() && !this.isCancelled()) {
      await super.emit({ value: this.value });
      this.emitted = true;
    }
    if(!this.isUnsubscribed() && !this.isCancelled()) {
      this.isAutoComplete.resolve(true);
    }
  }
}

export function of(value: any) {
  return new OfStream(value);
}
