import { Stream } from '../abstractions/stream';

export class FromPromiseStream extends Stream {
  private promise: Promise<any> | undefined;
  private resolved: boolean = false; // Track if the promise has been resolved
  private value: any; // Store resolved value

  constructor(promise: Promise<any>) {
    super();
    this.promise = promise;
  }

  override async run(): Promise<void> {
    if (this.isUnsubscribed() || this.isAutoComplete()) {
      return;
    }

    if (!this.resolved) {
      try {
        this.value = await this.promise; // Resolve promise and store value
        this.resolved = true;
      } catch (error) {
        this.isFailed.resolve(error);
        return;
      }
    }

    // Emit stored value
    await this.onEmission.process({ emission: { value: this.value }, next: this.head! });
    this.isAutoComplete.resolve(true);
  }
}


export function fromPromise(promise: Promise<any>) {
  return new FromPromiseStream(promise);
}
