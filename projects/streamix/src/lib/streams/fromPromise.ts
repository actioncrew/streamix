import { Stream } from '../abstractions/stream';

export class FromPromiseStream<T = any> extends Stream<T> {
  private resolved: boolean = false;
  private value: T | undefined;

  constructor(private readonly promise: Promise<T>) {
    super();
  }

  async run(): Promise<void> {
    try {
      if (!this.resolved) {
        const resolutionPromise = this.resolvePromise();
        await Promise.race([
          resolutionPromise,
          this.awaitCompletion()
        ]);

        // If we've been completed, don't continue
        if (this.shouldComplete()) {
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
