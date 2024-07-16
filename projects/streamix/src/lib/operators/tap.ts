import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class TapOperator extends AbstractOperator {
  private readonly tapFunction: (value: any) => void;

  constructor(tapFunction: (value: any) => void) {
    super();
    this.tapFunction = tapFunction;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    try {
      this.tapFunction(emission.value);
    } catch (error: any) {
      // swallow error
      // emission.isFailed = true;
      // emission.error = error;
      // stream.isFailed.resolve(error);
      return emission;
    }

    return this.next?.process(emission, stream) ?? Promise.resolve(emission);
  }
}

export function tap(tapFunction: (value: any) => void) {
  return new TapOperator(tapFunction);
}
