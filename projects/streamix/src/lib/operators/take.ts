import { Chunk, Stream, Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class TakeOperator extends Operator {
  private emittedCount!: number;

  constructor(private readonly count: number) {
    super();
  }

  override init(stream: Chunk) {
    this.emittedCount = 0;
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    if (this.emittedCount < this.count) {
      this.emittedCount++;

      if(this.emittedCount === this.count) {
        stream.isAutoComplete = true;
      }
      return emission;
    } else {
      emission.isPhantom = true;
      return emission;
    }
  }
}

export const take = (count: number) => new TakeOperator(count);

