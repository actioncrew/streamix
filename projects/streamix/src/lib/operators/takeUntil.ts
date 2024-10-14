import { Subscription } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';
import { Subscribable } from '../abstractions/subscribable';

export class TakeUntilOperator extends Operator {
  private readonly notifier: Subscribable;
  private subscription: Subscription | undefined;
  private stopRequested;

  constructor(notifier: Subscribable) {
    super();
    this.notifier = notifier;
    this.stopRequested = false;
  }

  override init() {
    this.subscription = this.notifier.subscribe(() => {
      this.stopRequested = true;
      this.subscription?.unsubscribe();
    });
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    if (this.stopRequested) {
      stream.isStopRequested.resolve(true);
      emission.isPhantom = true;
      return emission;
    }

    if(stream.isCancelled()) {
      emission.isPhantom = true;
    }
    return emission;
  }
}

export const takeUntil = (notifier: Subscribable) => new TakeUntilOperator(notifier);
