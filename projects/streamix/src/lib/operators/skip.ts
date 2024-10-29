import { Chunk, Stream, Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class SkipOperator extends Operator {
  private counter!: number;

  constructor(private readonly count: number) {
    super();
  }

  override init(stream: Chunk) {
    this.counter = this.count;
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    if (this.counter <= 0) {
      return emission;
    } else {
      this.counter--;
      emission.isPhantom = true;
      return emission
    }
  }
}

export const skip = (count: number) => new SkipOperator(count);

