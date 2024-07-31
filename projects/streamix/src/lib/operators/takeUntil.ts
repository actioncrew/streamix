import { Subscription } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';

export class TakeUntilOperator extends AbstractOperator {
  private readonly notifier: AbstractStream;
  private subscription: Subscription | undefined;

  constructor(notifier: AbstractStream) {
    super();
    this.notifier = notifier;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      this.subscription?.unsubscribe();
      return emission;
    }

    if (!this.subscription) {
      this.subscription = this.notifier.subscribe(() => {
        stream.isStopRequested.resolve(true);
        this.subscription!.unsubscribe();
      });
    }

    if(stream.isStopRequested.value) {
      emission.isPhantom = true;
    }
    return emission;
  }
}

export const takeUntil = (notifier: AbstractStream) => new TakeUntilOperator(notifier);
