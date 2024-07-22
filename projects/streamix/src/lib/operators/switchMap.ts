import { AbstractOperator, AbstractStream, Emission, StreamSink } from '../abstractions';

export class SwitchMapOperator extends AbstractOperator {
  private readonly project: (value: any) => AbstractStream;
  private activeInnerStream?: AbstractStream;
  private outerStream: AbstractStream;
  private innerStreamSubscription?: any;

  private innerSink?: StreamSink;
  private outerSink?: StreamSink;

  constructor(project: (value: any) => AbstractStream) {
    super();
    this.project = project;
    this.outerStream = new AbstractStream();
    this.initializeOuterStream();
  }

  private initializeOuterStream() {
    Object.assign(this.outerStream, {
      run: async () => {
        await Promise.race([
          this.outerStream.awaitCompletion(),
          this.outerStream.awaitTermination()
        ]);
        if (this.activeInnerStream) {
          await this.activeInnerStream.awaitCompletion();
        }
        await this.cleanup();
      }
    });

    // Listen to the outer stream's events
    this.outerStream.isCancelled.then(() => this.cleanup());
    this.outerStream.isStopped.then(() => this.cleanup());
  }

  private async cleanup() {
    await this.stopInnerStream();
    if (this.innerSink) {
      this.innerSink.complete();
    }
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (!this.innerSink) { this.innerSink = stream instanceof StreamSink ? stream : new StreamSink(stream); }
    if (!this.outerSink) { this.outerSink = this.innerSink.split(this, this.outerStream); }

    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      await this.stopInnerStream();
      this.innerSink.complete();
      return emission;
    }

    try {
      return await this.processEmission(emission, stream);
    } catch (error) {
      return Promise.reject(error); // Reject the outer promise on error
    }
  }

  private async processEmission(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    const newInnerStream = this.project(emission.value);
    this.activeInnerStream = newInnerStream;

    // Unsubscribe from the previous inner stream if it exists
    if (this.innerStreamSubscription) {
      this.innerStreamSubscription.unsubscribe();
    }

    // Subscribe to the new inner stream and handle emissions
    this.innerStreamSubscription = newInnerStream.subscribe(async (value) => {
      if (!stream.isCancelled.value) {
        await this.outerSink!.emit({ value });
      }
    });

    // Handle inner stream errors
    newInnerStream.isFailed.then((error) => {
      emission.error = error;
      emission.isFailed = true;
      this.innerStreamSubscription.unsubscribe();
      this.removeInnerStream(newInnerStream);
    });

    // Handle inner stream completion
    newInnerStream.isStopped.then(() => {
      this.innerStreamSubscription.unsubscribe();
      this.removeInnerStream(newInnerStream);
    }).catch((error) => {
      emission.error = error;
      emission.isFailed = true;
      this.removeInnerStream(newInnerStream);
    });

    // Ensure only the latest inner stream remains active
    if (this.activeInnerStream !== newInnerStream) {
      this.innerStreamSubscription.unsubscribe();
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

  private async stopInnerStream() {
    if (this.activeInnerStream) {
      this.activeInnerStream.terminate();
      this.removeInnerStream(this.activeInnerStream);
    }
  }
}

export function switchMap(project: (value: any) => AbstractStream) {
  return new SwitchMapOperator(project);
}
