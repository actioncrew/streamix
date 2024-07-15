import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class SkipOperator extends AbstractOperator {
  private count: number;

  constructor(count: number) {
    super();
    this.count = count;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }
    if (this.count <= 0) {
      return this.next?.process(emission, stream) ?? Promise.resolve(emission);
    } else {
      this.count--;
      emission.isPhantom = true;
      return Promise.resolve(emission);
    }
  }
}

export function skip(count: number) {
  return new SkipOperator(count);
}
