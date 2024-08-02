import { Stream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class ScanOperator extends Operator {
  private readonly accumulator: (acc: any, value: any, index?: number) => any;
  private readonly seed: any;
  private accumulatedValue: any;
  private index = 0;

  constructor(accumulator: (acc: any, value: any, index?: number) => any, seed: any) {
    super();
    this.accumulator = accumulator;
    this.seed = seed;
    this.accumulatedValue = seed;
  }

  async handle(emission: Emission, stream: Stream): Promise<Emission> {
    this.accumulatedValue = this.accumulator(this.accumulatedValue, emission.value!, this.index++);
    emission.value = this.accumulatedValue;
    return emission;
  }
}

export const scan = (accumulator: (acc: any, value: any, index?: number) => any, seed: any) => new ScanOperator(accumulator, seed);

