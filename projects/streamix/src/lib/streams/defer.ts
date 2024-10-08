import { Subscribable } from '../abstractions';
import { Stream } from '../abstractions/stream';

export class DeferStream<T = any> extends Stream<T> {
  private readonly factory: () => Subscribable;
  private innerStream?: Subscribable;
  private handleEmissionFn: (event: { emission: { value: T }, source: Subscribable }) => void;

  constructor(factory: () => Subscribable) {
    super();
    this.factory = factory;
    this.handleEmissionFn = ({ emission, source }) => this.handleEmission(emission.value);
  }

  override async run(): Promise<void> {
    try {
      // Create a new stream from the factory function each time this stream is run
      this.innerStream = this.factory();

      // Set up emission handling
      this.innerStream.onEmission.chain(this, this.handleEmissionFn);

      // Start the inner stream
      this.innerStream.start(this.innerStream);

      // Wait for completion or termination
      await Promise.race([this.innerStream.awaitCompletion(), this.innerStream.awaitTermination(), this.awaitTermination()]);

      // Handle auto-completion
      if (this.innerStream.shouldComplete()) {
        this.isAutoComplete.resolve(true);
      } else if(this.innerStream.shouldTerminate()) {
        await this.handleError(this.innerStream.isFailed());
      }

    } catch (error) {
      await this.handleError(error);
    } finally {
      await this.cleanupInnerStream();
    }
  }

  private async handleEmission(value: T): Promise<void> {
    if (this.shouldComplete() || this.shouldTerminate()) {
      return;
    }

    await this.onEmission.process({
      emission: { value },
      source: this,
    });
  }

  private async handleError(error: any): Promise<void> {
    this.isFailed.resolve(error);
    await this.onError.process({ emission: { isFailed: true, error }, source: this });
  }

  private async cleanupInnerStream(): Promise<void> {
    if (this.innerStream) {
      this.innerStream.onEmission.remove(this, this.handleEmissionFn);
      await this.innerStream.complete();
      this.innerStream = undefined;
    }
  }

  override async complete(): Promise<void> {
    await this.cleanupInnerStream();
    return super.complete();
  }

  override async terminate(): Promise<void> {
    await this.cleanupInnerStream();
    return super.terminate();
  }
}

// Factory function to create a new stream instance
export function defer<T = any>(factory: () => Subscribable): Stream<T> {
  return new DeferStream<T>(factory);
}
