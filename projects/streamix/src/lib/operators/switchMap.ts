import { AbstractOperator, AbstractStream, Emission, StreamSink } from '../abstractions';

export class SwitchMapOperator extends AbstractOperator {
  private readonly project: (value: any) => AbstractStream;
  private activeInnerStream?: AbstractStream;
  private outerStream: AbstractStream;

  private left!: StreamSink;
  private right!: StreamSink;

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

    const streamSink = stream instanceof StreamSink ? stream : new StreamSink(stream);
    if (!this.left) [this.left, this.right] = streamSink.split(this, streamSink);

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

  private async processEmission(emission: Emission, stream: AbstractStream) {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    const newInnerStream = this.project(emission.value);
    this.activeInnerStream = newInnerStream;

    // Subscribe to the new inner stream and handle emissions
    const subscription = newInnerStream.subscribe(async (value) => {
      await this.right.emit({ value });
    });

    // Handle inner stream errors
    newInnerStream.isFailed.then((error) => {
      emission.error = error;
      emission.isFailed = true;
      subscription.unsubscribe();
      this.removeInnerStream(newInnerStream);
    });

    // Handle inner stream completion
    newInnerStream.isStopped.then(() => {
      subscription.unsubscribe();
      this.removeInnerStream(newInnerStream);
    }).catch((error) => {
      emission.error = error;
      emission.isFailed = true;
      this.removeInnerStream(newInnerStream);
    });

    // Ensure only the latest inner stream remains active
    if (this.activeInnerStream !== newInnerStream) {
      subscription.unsubscribe();
      this.removeInnerStream(newInnerStream);
      emission.isPhantom = true; // Indicate that this emission is ignored
    }

    emission.isPhantom = true;
    return new Promise<Emission>((resolve) => {
      newInnerStream.isStopped.then(() => resolve(emission));
    });
  }

  private removeInnerStream(innerStream: AbstractStream) {
    if (this.activeInnerStream === innerStream) {
      this.activeInnerStream = undefined;
    }
  }
}

export function switchMap(project: (value: any) => AbstractStream) {
  return new SwitchMapOperator(project);
}
