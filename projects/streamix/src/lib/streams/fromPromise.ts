import { Stream } from '../abstractions/stream';

export class FromPromiseStream<T = any> extends Stream<T> {
  private resolved: boolean = false;
  private promiseValue: T | undefined;

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

      await this.onEmission.process({ emission: { value: this.promiseValue as T }, source: this });
      this.isAutoComplete = true;
    } catch (error) {
      await this.onError.process({ error });
    }
  }

  private async resolvePromise(): Promise<void> {
    try {
      this.promiseValue = await this.promise;
      this.resolved = true;
    } catch (error) {
      await this.onError.process({ error });
    }
  }
}

export function fromPromise<T = any>(promise: Promise<T>): FromPromiseStream<T> {
  return new FromPromiseStream<T>(promise);
}
