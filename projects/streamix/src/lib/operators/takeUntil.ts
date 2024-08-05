import { Subscription } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';
import { Subscribable } from '../abstractions/subscribable';

export class TakeUntilOperator extends Operator {
  private readonly notifier: Subscribable;
  private subscription: Subscription | undefined;

  constructor(notifier: Subscribable) {
    super();
    this.notifier = notifier;
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    if (stream.isCancelled()) {
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

    if(stream.isStopRequested()) {
      emission.isPhantom = true;
    }
    return emission;
  }
}

export const takeUntil = (notifier: Subscribable) => new TakeUntilOperator(notifier);
