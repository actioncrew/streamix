import { Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class TakeWhileOperator extends Operator {

  constructor(private readonly predicate: (value: any, index?: number) => boolean) {
    super();
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    const shouldContinue = this.predicate(emission.value);
    if (!shouldContinue) {
      emission.isPhantom = true;
      stream.complete();
      return emission
    }

    return emission;
  }
}

export const takeWhile = (predicate: (value: any, index?: number) => boolean) => new TakeWhileOperator(predicate);
