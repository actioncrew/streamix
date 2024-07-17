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
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    stream.isStopped.then(() => {
      this.subscription.unsubscribe();
    });

    try {
      const latestValue = await this.latestValue.value;
      emission.value = [emission.value, latestValue];
    } catch (error) {
      emission.error = error;
      emission.isFailed = true;
      stream.isFailed.resolve(true);
      stream.isStopped.resolve(true);
    }

    return this.next?.process(emission, stream) ?? Promise.resolve(emission);
  }
}

export function withLatestFrom(otherStream: AbstractStream) {
  return new WithLatestFromOperator(otherStream);
}
