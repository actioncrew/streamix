import { Stream } from '../abstractions/stream';

export class FromPromiseStream<T = any> extends Stream<T> {
  private promise: Promise<T>;
  private resolved: boolean = false;
  private value: T | undefined;

  constructor(promise: Promise<T>) {
    super();
    this.promise = promise;
  }

  override async run(): Promise<void> {
    try {
      if (!this.resolved) {
        const resolutionPromise = this.resolvePromise();
        await Promise.race([
          resolutionPromise,
          this.awaitCompletion(),
          this.awaitTermination()
        ]);

        // If we've been completed or terminated, don't continue
        if (this.shouldComplete() || this.shouldTerminate()) {
          return;
        }
      }

      await this.onEmission.process({ emission: { value: this.value as T }, source: this });
      this.isAutoComplete.resolve(true);
    } catch (error) {
      await this.handleError(error);
    }
  }

  private async resolvePromise(): Promise<void> {
    try {
      this.value = await this.promise;
      this.resolved = true;
    } catch (error) {
      await this.handleError(error);
    }
  }
}

export function fromPromise<T = any>(promise: Promise<T>): FromPromiseStream<T> {
  return new FromPromiseStream<T>(promise);
}
