import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';
import { Stream } from '../abstractions/stream';

export class IifOperator extends Operator {
  private outerStream: Stream;

  private input?: Stream;
  private output?: Stream;

  constructor(
    private readonly condition: (emission: Emission) => boolean,
    private readonly trueStream: Stream,
    private readonly falseStream: Stream
  ) {
    super();
    this.outerStream = new Stream();

    Object.assign(this.outerStream, {
      run: () => {
        return Promise.race([
          this.outerStream.awaitCompletion(),
          this.outerStream.awaitTermination()
        ]);
      }
    });
  }

  async handle(emission: Emission, stream: Stream): Promise<Emission> {
    this.input = this.input || stream;
    this.output = this.output || stream.combine(this.outerStream);

    const innerStream = this.condition(emission) ? this.trueStream : this.falseStream;

    const subscription = innerStream.subscribe(async (value) => {
      await this.output!.emit({value}, this.output?.head!);
    });

    Promise.race([innerStream.awaitCompletion(), innerStream.awaitTermination()]).then((error) => {
      subscription.unsubscribe();
      this.output?.complete();
      this.input?.complete();
    });

    emission.isPhantom = true;

    return new Promise<Emission>((resolve) => {
      innerStream.isStopped.then(() => resolve(emission));
    });
  }
}

export const iif = (condition: (emission: Emission) => boolean, trueStream: Stream, falseStream: Stream) => new IifOperator(condition, trueStream, falseStream);
