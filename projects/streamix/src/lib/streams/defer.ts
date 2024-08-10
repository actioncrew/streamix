import { Subscription } from '../abstractions';
import { Stream } from '../abstractions/stream';

export class DeferStream extends Stream {
  private readonly factory: () => Stream;
  private subscription?: Subscription;
  private promise: Promise<void> = Promise.resolve();

  constructor(factory: () => Stream) {
    super();
    this.factory = factory;
  }

  override async run(): Promise<void> {
    try {
      // Create a new stream from the factory function each time this stream is run
      const innerStream = this.factory();

      // Forward emissions from the inner stream
      this.subscription = innerStream.subscribe(async (value) => {
        this.promise = this.onEmission.process({ emission: { value }, source: this });
        await this.promise;
      });

      // Handle completion and errors from the inner stream
      innerStream.isStopped.then(() => {
        if (!this.isStopRequested()) {
          this.isAutoComplete.resolve(true);
        }
      });

      innerStream.isFailed.then((error) => {
        this.isFailed.resolve(error);
      });

      await Promise.race([this.awaitCompletion(), this.awaitTermination()]);
      await this.promise;
    } catch (error) {
      this.isFailed.resolve(error);
    }
  }

  override subscribe(callback: void | ((value: any) => any)): Subscription {

    let subscription = super.subscribe(callback);
    let originalUnsubscribe = subscription.unsubscribe.bind(subscription);
    subscription.unsubscribe = () => {
      if(this.subscription) {
        this.subscription.unsubscribe();
      }
      originalUnsubscribe();
    }

    return subscription;
  }
}

// Factory function to create a new stream instance
export function defer(factory: () => Stream): Stream {
  return new DeferStream(factory);
}
