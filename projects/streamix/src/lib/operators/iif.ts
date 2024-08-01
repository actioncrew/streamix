import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';

export class IifOperator extends AbstractOperator {
  private outerStream: AbstractStream;

  private input?: AbstractStream;
  private output?: AbstractStream;

  constructor(
    private readonly condition: (emission: Emission) => boolean,
    private readonly trueStream: AbstractStream,
    private readonly falseStream: AbstractStream
  ) {
    super();
    this.outerStream = new AbstractStream();

    Object.assign(this.outerStream, {
      run: () => {
        return Promise.race([
          this.outerStream.awaitCompletion(),
          this.outerStream.awaitTermination()
        ]);
      }
    });
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    this.input = this.input || stream;
    this.output = this.output || stream.combine(this, this.outerStream);

    const innerStream = this.condition(emission) ? this.trueStream : this.falseStream;

    const subscription = innerStream.subscribe(async (value) => {
      await this.output!.emit({value}, this.next!);
    });

    Promise.race([innerStream.awaitCompletion(), innerStream.awaitTermination()]).then((error) => {
      subscription.unsubscribe();
    });

    emission.isPhantom = true;

    return new Promise<Emission>((resolve) => {
      innerStream.isStopped.then(() => resolve(emission));
    });
  }
}

export const iif = (condition: (emission: Emission) => boolean, trueStream: AbstractStream, falseStream: AbstractStream) => new IifOperator(condition, trueStream, falseStream);
