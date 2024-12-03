import { Stream, Subscription } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';
import { Subscribable } from '../abstractions/subscribable';

export class TakeUntilOperator extends Operator {
  private subscription!: Subscription;
  private stopRequested!: boolean;

  constructor(private readonly notifier: Subscribable) {
    super();
  }

  override init(stream: Stream) {
    this.stopRequested = false;

    this.subscription = this.notifier.subscribe(() => {
      this.stopRequested = true;
      this.subscription?.unsubscribe();
    });
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    if (this.stopRequested) {
      stream.complete();
      emission.phantom = true;
      return emission;
    }

    return emission;
  }
}

export const takeUntil = (notifier: Subscribable) => new TakeUntilOperator(notifier);
