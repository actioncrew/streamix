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

  handle(request: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled) {
      return Promise.resolve({ ...request, isCancelled: true });
    }

    if (!this.isLatestValueSet) {
      return Promise.resolve({ ...request, isCancelled: true });
    }

    const emission = {
      value: [request.value, this.latestValue],
      isCancelled: false,
      isPhantom: false,
      error: undefined
    };

    return this.next?.process(emission, stream) ?? Promise.resolve(emission);
  }
}

export function withLatestFrom(otherStream: AbstractStream) {
  return new WithLatestFromOperator(otherStream);
}
