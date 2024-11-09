import { Subscribable, Subscription } from '../abstractions';
import { Stream } from '../abstractions/stream';
import { Emission } from '../abstractions';

export class IifStream<T = any> extends Stream<T> {
  private innerStream?: Subscribable;
  private subscription!: Subscription;

  constructor(
    private readonly condition: (emission: Emission) => boolean,
    private readonly trueStream: Stream<T>,
    private readonly falseStream: Stream<T>
  ) {
    super();
  }

  async run(): Promise<void> {
    // Select the stream based on the condition
    const selectedStream = this.condition({ value: null }) ? this.trueStream : this.falseStream;

    // Create the inner stream from the selected stream
    this.innerStream = selectedStream;

    // Start the selected stream and subscribe to it
    this.subscription = this.innerStream.subscribe((value) => this.handleEmission(value));

    this.innerStream.onStop.once(async () => {
      this.subscription.unsubscribe();
    });

    // Wait for completion or termination
    await Promise.race([this.innerStream.awaitCompletion()]);
  }

  private async handleEmission(value: T): Promise<void> {
    if (this.shouldComplete()) {
      return;
    }

    await this.onEmission.parallel({
      emission: { value },
      source: this,
    });
  }
}

// Factory function to create the iif stream
export function iif<T = any>(
  condition: (emission: Emission) => boolean,
  trueStream: Stream<T>,
  falseStream: Stream<T>
): Stream<T> {
  return new IifStream<T>(condition, trueStream, falseStream);
}
