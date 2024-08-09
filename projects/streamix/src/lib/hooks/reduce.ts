import { Stream, Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';
import { Hook } from './../abstractions/hook';

export class ReduceOperator extends Operator implements Hook {
  private boundStream!: Stream;
  private readonly accumulator: (acc: any, value: any) => any;
  private readonly seed: any;
  private accumulatedValue: any;

  constructor(accumulator: (acc: any, value: any) => any, seed: any) {
    super();
    this.accumulator = accumulator;
    this.seed = seed;
    this.accumulatedValue = seed;
  }

  init(stream: Stream) {
    this.boundStream = stream;
    this.boundStream.onComplete.chain(this.callback.bind(this));
  }

  async callback(params?: any): Promise<void> {
    // TODO ---- this.next
    await this.boundStream.onEmission.process({ emission: { value: this.accumulatedValue }, next: this.next });
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    this.accumulatedValue = this.accumulator(this.accumulatedValue, emission.value!);
    emission.isPhantom = true;
    return emission;
  }
}

export const reduce = (accumulator: (acc: any, value: any) => any, seed: any) => new ReduceOperator(accumulator, seed);
