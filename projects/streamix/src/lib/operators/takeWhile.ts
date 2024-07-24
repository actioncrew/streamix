import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class TakeWhileOperator extends AbstractOperator {
  private readonly predicate: (value: any) => boolean;

  constructor(predicate: (value: any, index?: number) => boolean) {
    super();
    this.predicate = predicate;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    const shouldContinue = this.predicate(emission.value);
    if (!shouldContinue) {
      emission.isPhantom = true;
      stream.isStopRequested.resolve(true);
      return Promise.resolve(emission);
    }

    return emission;
  }
}

export function takeWhile(predicate: (value: any, index?: number) => boolean) {
  return new TakeWhileOperator(predicate);
}
