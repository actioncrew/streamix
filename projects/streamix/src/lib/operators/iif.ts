import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';

export class IifOperator extends AbstractOperator {
  constructor(
    private readonly condition: () => boolean,
    private readonly trueStream: AbstractStream,
    private readonly falseStream: AbstractStream
  ) {
    super();
  }

  handle(request: Emission, stream: AbstractStream): Promise<Emission> {
    const selectedStream = this.condition() ? this.trueStream : this.falseStream;
    return new Promise<Emission>((resolve) => {
      selectedStream.subscribe((value: any) => {
        resolve({ value, isCancelled: false, isPhantom: false, error: undefined });
      });
    }).then((emission) => {
      return this.next?.process(emission, stream) ?? Promise.resolve(emission);
    });
  }
}

export function iif(condition: () => boolean, trueStream: AbstractStream, falseStream: AbstractStream) {
  return new IifOperator(condition, trueStream, falseStream);
}
