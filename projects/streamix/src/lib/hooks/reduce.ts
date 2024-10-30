import { Chunk, Stream, Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator, HookOperator } from '../abstractions/operator';

export class ReduceOperator extends Operator implements HookOperator {
  private chunk!: Chunk;
  private accumulatedValue: any;

  constructor(private readonly accumulator: (acc: any, value: any) => any, private readonly seed: any) {
    super();
    this.accumulator = accumulator;
    this.accumulatedValue = seed;
  }

  override init(stream: Chunk) {
    this.chunk = stream;
    this.chunk.onComplete.chain(this, this.callback);
  }

  async callback(params?: any): Promise<void> {
    await this.chunk.stream.onEmission.parallel({ emission: { value: this.accumulatedValue }, source: this });
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    this.accumulatedValue = this.accumulator(this.accumulatedValue, emission.value!);
    emission.isPhantom = true;
    return emission;
  }
}

export const reduce = (accumulator: (acc: any, value: any) => any, seed: any) => new ReduceOperator(accumulator, seed);
