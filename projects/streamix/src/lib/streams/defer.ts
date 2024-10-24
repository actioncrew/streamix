import { Subscribable } from '../abstractions';
import { Stream } from '../abstractions/stream';

export class DeferStream<T = any> extends Stream<T> {
  private innerStream?: Subscribable;
  private handleEmissionFn: (event: { emission: { value: T }, source: Subscribable }) => void;

  constructor(private readonly factory: () => Subscribable) {
    super();
    this.handleEmissionFn = ({ emission, source }) => this.handleEmission(emission.value);
  }

  async run(): Promise<void> {
    try {
      // Create a new stream from the factory function each time this stream is run
      this.innerStream = this.factory();

      // Set up emission handling
      this.innerStream.onEmission.chain(this, this.handleEmissionFn);

      // Start the inner stream
      this.innerStream.start();

      // Wait for completion or termination
      await Promise.race([this.innerStream.awaitCompletion()]);

    } catch (error) {
      await this.onError.process({ error });
    } finally {
      await this.cleanupInnerStream();
    }
  }

  private async handleEmission(value: T): Promise<void> {
    if (this.shouldComplete()) {
      return;
    }

    await this.onEmission.process({
      emission: { value },
      source: this,
    });
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
}

// Factory function to create a new stream instance
export function defer<T = any>(factory: () => Subscribable): Stream<T> {
  return new DeferStream<T>(factory);
}
