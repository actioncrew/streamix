import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class TakeOperator extends AbstractOperator {
  private count: number;
  private emittedCount: number = 0;

  constructor(count: number) {
    super();
    this.count = count;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }
    if (this.emittedCount < this.count) {
      this.emittedCount++;
      let promise = this.next?.process(emission, stream) ?? Promise.resolve(emission);
      if(this.emittedCount === this.count) {
        stream.isStopRequested.resolve(true);
      }
      return promise;
    } else {
      emission.isPhantom = true;
      return emission;
    }
  }
}

export function take(count: number) {
  return new TakeOperator(count);
}
