import { Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class TapOperator extends Operator {
  private readonly tapFunction: (value: any) => void;

  constructor(tapFunction: (value: any) => void) {
    super();
    this.tapFunction = tapFunction;
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    this.tapFunction(emission.value);
    return emission;
  }
}

export const tap = (tapFunction: (value: any) => void) => new TapOperator(tapFunction);

