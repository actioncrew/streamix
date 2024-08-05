import { Stream, Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class IifOperator extends Operator {
  private outerStream: Stream;

  private input?: Subscribable;
  private output?: Subscribable;

  constructor(
    private readonly condition: (emission: Emission) => boolean,
    private readonly trueStream: Subscribable,
    private readonly falseStream: Subscribable
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

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    this.input = this.input || stream;
    this.output = this.output || this.outerStream;

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

export const iif = (condition: (emission: Emission) => boolean, trueStream: Subscribable, falseStream: Subscribable) => new IifOperator(condition, trueStream, falseStream);
