import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';

export class WithLatestFromOperator extends AbstractOperator {
  private latestValue: any | undefined;
  private latestValuePromise: Promise<any>;
  private hasLatestValue: boolean = false;

  constructor(private readonly otherStream: AbstractStream) {
    super();
    this.latestValuePromise = new Promise((resolve, reject) => {
      otherStream.subscribe((value) => {
        this.latestValue = value;
        this.hasLatestValue = true;
        resolve(value);
      });

      otherStream.isFailed.promise.then((error) => {
        reject(error);
      });
    });
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    try {
      const latestValue = await this.latestValuePromise;
      emission.value = [emission.value, latestValue];
    } catch (error) {
      emission.error = error;
      emission.isFailed = true;
      stream.isFailed.resolve(true);
      stream.isStopped.resolve(true);
    }

    return this.next?.process(emission, stream) ?? Promise.resolve(emission);
  }
}

export function withLatestFrom(otherStream: AbstractStream) {
  return new WithLatestFromOperator(otherStream);
}
