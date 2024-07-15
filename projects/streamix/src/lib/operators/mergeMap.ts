import { AbstractOperator, AbstractStream, Emission, StreamSink } from '../abstractions';
import { PromisifiedCounter } from '../utils/counter';

export class MergeMapOperator extends AbstractOperator {
  private readonly project: (value: any) => AbstractStream;
  private outerStream: AbstractStream;
  private activeInnerStreams: AbstractStream[] = [];

  private left!: StreamSink;
  private right!: StreamSink;

  private counter = new PromisifiedCounter(0, 1);

  constructor(project: (value: any) => AbstractStream) {
    super();
    this.project = project;
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

    try {
      return this.processEmission(emission, stream);
    } catch (error) {
      return Promise.reject(error); // Reject the outer promise on error
    }
  }

  private processEmission(emission: Emission, stream: AbstractStream) {
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
    const innerStream = this.project(emission.value);
    this.activeInnerStreams.push(innerStream); // Track the active inner stream
    this.counter.increment();

    // Subscribe to inner stream and handle emissions
    const subscription = innerStream.subscribe(async (value) => {
      await this.right.emit({value});
    });

    innerStream.isFailed.promise.then((error) => {
      emission.error = error;
      emission.isFailed = true;
      subscription.unsubscribe();
      this.removeInnerStream(innerStream); // Remove inner stream on error
    });

    // Handle inner stream completion
    innerStream.isStopped.promise.then(() => {
      subscription.unsubscribe();
      this.removeInnerStream(innerStream);
      emission.isComplete = true;
    }).catch((error) => {
      emission.error = error;
      emission.isFailed = true;
      this.removeInnerStream(innerStream);
    });

    this.counter.subscribe(() => {
      if(stream.isUnsubscribed.value || stream.isAutoComplete.value ||
          stream.isFailed.value || stream.isCancelled.value ||
          stream.isStopRequested.value
        ) {
          this.left?.isStopped.resolve(true);
      }
    });

    emission.isPhantom = true;

    return new Promise<Emission>((resolve) => {
      innerStream.isStopped.promise.then(() => resolve(emission));
    });
  }

  private removeInnerStream(innerStream: AbstractStream) {
    const index = this.activeInnerStreams.indexOf(innerStream);
    if (index !== -1) {
      this.activeInnerStreams.splice(index, 1);
      this.counter.decrement();
    }
  }
}

export function mergeMap(project: (value: any) => AbstractStream) {
  return new MergeMapOperator(project);
}
