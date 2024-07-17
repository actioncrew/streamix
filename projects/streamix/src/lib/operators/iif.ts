import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream, StreamSink } from '../abstractions/stream';

export class IifOperator extends AbstractOperator {
  private left!: StreamSink;
  private right!: StreamSink;
  private outerStream!: AbstractStream;

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
          this.outerStream.isUnsubscribed.promise,
          this.outerStream.isAutoComplete.promise,
          this.outerStream.isFailed.promise,
          this.outerStream.isCancelled.promise,
          this.outerStream.isStopRequested.promise
        ]);
      }
    });
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    let streamSink = stream as StreamSink;
    if(!(streamSink instanceof StreamSink)) {
      streamSink = new StreamSink(streamSink);
    }
    if(streamSink instanceof StreamSink && this.left === undefined) {
      const [left, right] = streamSink.split(this, this.outerStream);
      this.left = left; this.right = right;
    }

    const innerStream = this.condition(emission) ? this.trueStream : this.falseStream;

    const subscription = innerStream.subscribe(async (value) => {
      await this.right.emit({value});
    });

    Promise.race([innerStream.isUnsubscribed.promise || innerStream.isAutoComplete.promise ||
      innerStream.isFailed.promise || innerStream.isCancelled.promise ||
      innerStream.isStopRequested.promise]).then((error) => {
      subscription.unsubscribe();
    });

    emission.isPhantom = true;

    return new Promise<Emission>((resolve) => {
      innerStream.isStopped.then(() => resolve(emission));
    });
  }
}

export function iif(condition: (emission: Emission) => boolean, trueStream: AbstractStream, falseStream: AbstractStream) {
  return new IifOperator(condition, trueStream, falseStream);
}
