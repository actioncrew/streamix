import { Subscription } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';
import { PromisifiedValue } from '../utils/value';

export class WithLatestFromOperator extends AbstractOperator {
  private latestValue = new PromisifiedValue();
  private subscription: Subscription;

  constructor(readonly otherStream: AbstractStream) {
    super();
    this.subscription = otherStream.subscribe((value) => {
      this.latestValue.value = value;
    });
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {

    try {
      const latestValue = await Promise.race([
        this.latestValue.value,
        stream.awaitTermination(),
        this.otherStream.awaitTermination()
      ]);

      if (stream.shouldTerminate() || this.otherStream.shouldTerminate()) {
        emission.isCancelled = true;
        this.subscription.unsubscribe();
        return emission;
      }

      emission.value = [emission.value, latestValue];
    } catch (error) {
      emission.error = error;
      emission.isFailed = true;
    }

    return emission;
  }
}

export function withLatestFrom(otherStream: AbstractStream) {
  return new WithLatestFromOperator(otherStream);
}
