import { Emission } from '../abstractions/emission';
import { AbstractStream } from '../abstractions/stream';

export class FromPromiseStream extends AbstractStream {
  private readonly promise: Promise<any>;
  private error?: Error;

  constructor(promise: Promise<any>) {
    super();
    this.promise = promise;
  }

  async run(): Promise<void> {
    if (this.isUnsubscribed.value || this.isAutoComplete.value) {
      return Promise.resolve();
    }

    const value = await this.promise;
    return super.emit({ value }).then(() => {
      this.isAutoComplete.resolve(true);
    });
  }

  override emit(emission: Emission): Promise<void> {
    if (this.error) {
      return Promise.reject(this.error);
    }
    return super.emit(emission);
  }
}

export function fromPromise(promise: Promise<any>) {
  return new FromPromiseStream(promise);
}
