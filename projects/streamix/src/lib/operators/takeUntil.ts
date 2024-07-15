import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';

export class TakeUntilOperator extends AbstractOperator {
  private readonly notifier: AbstractStream;

  constructor(notifier: AbstractStream) {
    super();
    this.notifier = notifier;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    return new Promise((resolve) => {
      const unsubscribe = this.notifier.subscribe(() => {
        unsubscribe.unsubscribe();
        emission.isComplete = true;
        resolve(emission);
      });

      if (this.next) {
        this.next.process(emission, stream).then(resolve);
      } else {
        resolve(emission);
      }
    });
  }
}

export function takeUntil(notifier: AbstractStream) {
  return new TakeUntilOperator(notifier);
}
