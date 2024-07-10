import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';

export class TakeUntilOperator extends AbstractOperator {
  private readonly notifier: AbstractStream;

  constructor(notifier: AbstractStream) {
    super();
    this.notifier = notifier;
  }

  handle(request: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled) {
      return Promise.resolve({ ...request, isCancelled: true });
    }

    return new Promise((resolve) => {
      const unsubscribe = this.notifier.subscribe(() => {
        unsubscribe.unsubscribe();
        resolve({ ...request, isComplete: true });
      });

      if (this.next) {
        this.next.process(request, stream).then(resolve);
      } else {
        resolve(request);
      }
    });
  }
}

export function takeUntil(notifier: AbstractStream) {
  return new TakeUntilOperator(notifier);
}
