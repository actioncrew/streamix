import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';

export class IifOperator extends AbstractOperator {
  constructor(
    private readonly condition: (emission: Emission) => boolean,
    private readonly trueStream: AbstractStream,
    private readonly falseStream: AbstractStream
  ) {
    super();
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission | AbstractStream> {
    return this.condition(emission) ? this.trueStream : this.falseStream;
  }
}

export function iif(condition: (emission: Emission) => boolean, trueStream: AbstractStream, falseStream: AbstractStream) {
  return new IifOperator(condition, trueStream, falseStream);
}
