import { Stream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';
import { Hook } from './../abstractions/hook';

export class ReduceOperator extends Operator implements Hook {
  private readonly accumulator: (acc: any, value: any) => any;
  private readonly seed: any;
  private accumulatedValue: any;

  constructor(accumulator: (acc: any, value: any) => any, seed: any) {
    super();
    this.accumulator = accumulator;
    this.seed = seed;
    this.accumulatedValue = seed;
  }

  async callback({ stream }: any): Promise<void> {
    await stream.emit({ value: this.accumulatedValue }, this.next!);
  }

  async handle(emission: Emission, stream: Stream): Promise<Emission> {
    this.accumulatedValue = this.accumulator(this.accumulatedValue, emission.value!);
    emission.isPhantom = true;
    return emission;
  }
}

export const reduce = (accumulator: (acc: any, value: any) => any, seed: any) => new ReduceOperator(accumulator, seed);
