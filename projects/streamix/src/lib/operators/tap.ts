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
    this.tapFunction(emission.value);
    return emission;
  }
}

export const tap = (tapFunction: (value: any) => void) => new TapOperator(tapFunction);

