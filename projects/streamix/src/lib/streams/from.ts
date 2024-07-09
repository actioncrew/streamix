import { AbstractStream } from '../abstractions/stream';

export class FromStream extends AbstractStream {
  private readonly values: any[];
  private index: number = 0;

  constructor(values: any[]) {
    super();
    this.values = values;
  }

  run() {
    const emitNext = (): Promise<void> => {
      if (this.index >= this.values.length) {
        this.isAutoComplete = true;
        this.isStopped.resolve(true);
        return Promise.resolve();
      }
      if(this.isUnsubscribed.value || this.isStopRequested || this.isCancelled) {
        this.isStopped.resolve(true);
        return Promise.resolve();
      }
      const value = this.values[this.index++];
      return super.emit({ value }).then(() => emitNext());
    };

    return emitNext().then(() => { this.isAutoComplete = true; });
  }
}

export function from(values: any[]) {
  return new FromStream(values);
}
