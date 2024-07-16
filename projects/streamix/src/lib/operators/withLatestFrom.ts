import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';

export class WithLatestFromOperator extends AbstractOperator {
  private latestValue: any | undefined;
  private latestValuePromise: Promise<any>;

  constructor(private readonly otherStream: AbstractStream) {
    super();

    this.latestValuePromise = new Promise<any>((resolve) => {
      otherStream.subscribe((value) => {
        this.latestValue = value;
        resolve(value);
      });
    });
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    await this.latestValuePromise;
    emission.value = [emission.value, this.latestValue];

    return this.next?.process(emission, stream) ?? Promise.resolve(emission);
  }
}

export function withLatestFrom(otherStream: AbstractStream) {
  return new WithLatestFromOperator(otherStream);
}
