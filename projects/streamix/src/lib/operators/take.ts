import { Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class TakeOperator extends Operator {
  private count: number;
  private emittedCount: number = 0;

  constructor(count: number) {
    super();
    this.count = count;
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    if (this.emittedCount < this.count) {
      this.emittedCount++;

      if(this.emittedCount === this.count) {
        stream.isAutoComplete.resolve(true);
      }
      return emission;
    } else {
      emission.isPhantom = true;
      return emission;
    }
  }
}

export const take = (count: number) => new TakeOperator(count);

