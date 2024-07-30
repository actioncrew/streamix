import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class ScanOperator extends AbstractOperator {
  private readonly accumulator: (acc: any, value: any) => any;
  private readonly seed: any;
  private accumulatedValue: any;

  constructor(accumulator: (acc: any, value: any) => any, seed: any) {
    super();
    this.accumulator = accumulator;
    this.seed = seed;
    this.accumulatedValue = seed;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    this.accumulatedValue = this.accumulator(this.accumulatedValue, emission.value!);
    emission.value = this.accumulatedValue;
    return emission;
  }
}

export function scan(accumulator: (acc: any, value: any) => any, seed: any) {
  return new ScanOperator(accumulator, seed);
}
