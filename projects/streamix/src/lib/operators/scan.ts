import { Chunk, Stream, Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class ScanOperator extends Operator {

  private accumulatedValue!: any;
  private index!: number;

  constructor(private readonly accumulator: (acc: any, value: any, index?: number) => any, private readonly seed: any) {
    super();
    this.accumulator = accumulator;

  }

  override init(stream: Chunk) {
    this.accumulatedValue = this.seed;
    this.index = 0;
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    this.accumulatedValue = this.accumulator(this.accumulatedValue, emission.value!, this.index++);
    emission.value = this.accumulatedValue;
    return emission;
  }
}

export const scan = (accumulator: (acc: any, value: any, index?: number) => any, seed: any) => new ScanOperator(accumulator, seed);

