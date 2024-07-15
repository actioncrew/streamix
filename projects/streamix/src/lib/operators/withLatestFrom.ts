import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';

export class WithLatestFromOperator extends AbstractOperator {
  private latestValue: any;
  private isLatestValueSet: boolean = false;

  constructor(private readonly otherStream: AbstractStream) {
    super();

    otherStream.subscribe((value: any) => {
      this.latestValue = value;
      this.isLatestValueSet = true;
    });
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    if (!this.isLatestValueSet) {
      emission.isCancelled = true;
      return Promise.resolve(emission);
    }

    emission.value = [emission.value, this.latestValue];
    return this.next?.process(emission, stream) ?? Promise.resolve(emission);
  }
}

export function withLatestFrom(otherStream: AbstractStream) {
  return new WithLatestFromOperator(otherStream);
}
