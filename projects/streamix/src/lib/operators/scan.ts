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
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    try {
      this.accumulatedValue = this.accumulator(this.accumulatedValue, emission.value!);
      emission.value = this.accumulatedValue;

      return this.next?.process(emission, stream) ?? Promise.resolve(emission);
    } catch (error) {
      emission.isFailed = true;
      emission.error = error;
      stream.isFailed.resolve(error);
      stream.isStopped.resolve(true);
      return Promise.resolve(emission);
    }
  }
}

export function scan(accumulator: (acc: any, value: any) => any, seed: any) {
  return new ScanOperator(accumulator, seed);
}
