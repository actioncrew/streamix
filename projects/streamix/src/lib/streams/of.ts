import { AbstractStream } from '../abstractions/stream';

export class OfStream extends AbstractStream {
  private readonly value: any;

  constructor(value: any) {
    super();
    this.value = value;
  }

  run(): Promise<void> {
    return (this.isUnsubscribed.value ? Promise.resolve() : super.emit({ value: this.value })).then(() => this.isAutoComplete.resolve(true));
  }
}

export function of(value: any) {
  return new OfStream(value);
}
