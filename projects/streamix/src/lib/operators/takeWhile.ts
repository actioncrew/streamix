import { Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class TakeWhileOperator extends Operator {
  private readonly predicate: (value: any) => boolean;

  constructor(predicate: (value: any, index?: number) => boolean) {
    super();
    this.predicate = predicate;
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    const shouldContinue = this.predicate(emission.value);
    if (!shouldContinue) {
      emission.isPhantom = true;
      stream.isStopRequested.resolve(true);
      return emission
    }

    return emission;
  }
}

export const takeWhile = (predicate: (value: any, index?: number) => boolean) => new TakeWhileOperator(predicate);
