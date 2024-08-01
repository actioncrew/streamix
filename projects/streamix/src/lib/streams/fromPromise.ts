import { Emission } from '../abstractions/emission';
import { Stream } from '../abstractions/stream';

export class FromPromiseStream extends Stream {
  private readonly promise: Promise<any>;
  private error?: Error;

  constructor(promise: Promise<any>) {
    super();
    this.promise = promise;
  }

  override async run(): Promise<void> {
    if (this.isUnsubscribed() || this.isAutoComplete()) {
      return Promise.resolve();
    }

    const value = await this.promise;
    return super.emit({ value }, this.head!).then(() => {
      this.isAutoComplete.resolve(true);
    });
  }

  override emit(emission: Emission): Promise<void> {
    if (this.error) {
      return Promise.reject(this.error);
    }
    return super.emit(emission, this.head!);
  }
}

export function fromPromise(promise: Promise<any>) {
  return new FromPromiseStream(promise);
}
