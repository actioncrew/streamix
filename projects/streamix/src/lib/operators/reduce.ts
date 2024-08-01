import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class ReduceOperator extends AbstractOperator {
  private readonly accumulator: (acc: any, value: any) => any;
  private readonly seed: any;
  private accumulatedValue: any;
  private hasCompleted: boolean = false;

  constructor(accumulator: (acc: any, value: any) => any, seed: any) {
    super();
    this.accumulator = accumulator;
    this.seed = seed;
    this.accumulatedValue = seed;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    stream.isAutoComplete.then(async () => {
      this.hasCompleted = true;
      await stream.emit({ value: this.accumulatedValue }, this.next!);
    })

    this.accumulatedValue = this.accumulator(this.accumulatedValue, emission.value!);
    emission.isPhantom = true;
    return emission;
  }
}

export const reduce = (accumulator: (acc: any, value: any) => any, seed: any) => new ReduceOperator(accumulator, seed);
