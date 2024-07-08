import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';

export class TakeUntilOperator extends AbstractOperator {
  private readonly notifier: AbstractStream;

  constructor(notifier: AbstractStream) {
    super();
    this.notifier = notifier;
  }

  handle(request: Emission, cancellationToken?: boolean): Promise<Emission> {
    if (cancellationToken) {
      return Promise.resolve({ ...request, isCancelled: true });
    }

    return new Promise((resolve) => {
      const unsubscribe = this.notifier.subscribe(() => {
        unsubscribe.unsubscribe();
        resolve({ ...request, isComplete: true });
      });

      if (this.next) {
        this.next.handle(request, cancellationToken).then(resolve);
      } else {
        resolve(request);
      }
    });
  }
}

export function takeUntil(notifier: AbstractStream) {
  return new TakeUntilOperator(notifier);
}
