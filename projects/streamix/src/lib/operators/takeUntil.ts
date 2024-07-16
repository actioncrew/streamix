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

  subscribeToNotifier(stream: AbstractStream) {
    this.subscription = this.notifier.subscribe(() => {
      if (this.subscription) {
        this.subscription.unsubscribe();
        stream.isStopRequested.resolve(true);
      }
    });
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    if (!this.subscription) {
      this.subscribeToNotifier(stream);
    }

    stream.isStopped.promise.then(() => {
      emission.isPhantom = true;
      return emission;
    });

    if (!stream.isStopped.value) {
      if (this.next) {
        this.next.process(emission, stream);
      }
    }
    return emission;
  }
}

export function takeUntil(notifier: AbstractStream) {
  return new TakeUntilOperator(notifier);
}
