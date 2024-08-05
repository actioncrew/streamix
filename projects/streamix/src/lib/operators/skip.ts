import { Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class SkipOperator extends Operator {
  private count: number;

  constructor(count: number) {
    super();
    this.count = count;
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    if (this.count <= 0) {
      return emission;
    } else {
      this.count--;
      emission.isPhantom = true;
      return emission
    }
  }
}

export const skip = (count: number) => new SkipOperator(count);

