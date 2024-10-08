import { Stream } from '../abstractions/stream';

export class FromPromiseStream<T = any> extends Stream<T> {
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
    await this.onEmission.process({ emission: { value: this.value }, source: this });
    this.isAutoComplete.resolve(true);
  }
}


export function fromPromise<T = any>(promise: Promise<any>) {
  return new FromPromiseStream<T>(promise);
}
