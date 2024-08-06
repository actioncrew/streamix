import { Subject } from '../../lib';
import { Stream, Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class IifOperator extends Operator {
  private outerStream = new Subject();

  private input?: Subscribable;
  private output?: Stream;
  private innerSubscription?: { unsubscribe: () => void };

  constructor(
    private readonly condition: (emission: Emission) => boolean,
    private readonly trueStream: Subscribable,
    private readonly falseStream: Subscribable
  ) {
    super();
    this.initializeOuterStream();
  }

  private initializeOuterStream() {
    this.outerStream.isCancelled.then(() => this.cleanup());
    this.outerStream.isFailed.then(() => this.cleanup());
    this.outerStream.isStopped.then(() => this.cleanup());
  }

  private async cleanup() {
    if (this.innerSubscription) {
      this.innerSubscription.unsubscribe();
    }

    if (this.outerStream) {
      await this.outerStream.complete();
    }

    if (this.input) {
      await this.input.complete();
    }

    if (this.output) {
      await this.output.complete();
    }
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    this.input = this.input || stream;
    this.output = this.output || this.outerStream;

    const innerStream = this.condition(emission) ? this.trueStream : this.falseStream;

    this.innerSubscription = innerStream.subscribe(async (value) => {
      await this.output!.emit({value}, this.output?.head!);
    });

    Promise.race([innerStream.awaitCompletion(), innerStream.awaitTermination()]).then((error) => {
      this.innerSubscription?.unsubscribe();
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
