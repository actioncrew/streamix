import { Emission, Operator, Stream, Subscription } from '../abstractions';

export class SwitchMapOperator extends Operator {
  private project: (value: any) => Stream;
  private activeInnerStream?: Stream;
  private outerStream: Stream;
  private output?: Stream;
  private innerStreamSubscription?: Subscription;

  constructor(project: (value: any) => Stream) {
    super();
    this.project = project;
    this.outerStream = new Stream();
    this.initializeOuterStream();
  }

  private initializeOuterStream() {
    this.outerStream.run = async () => {
      await Promise.race([
        this.outerStream.awaitCompletion(),
        this.outerStream.awaitTermination()
      ]);
      if (this.activeInnerStream) {
        await this.activeInnerStream.awaitCompletion();
      }
    };

    this.outerStream.isCancelled.then(() => this.cleanup());
    this.outerStream.isFailed.then(() => this.cleanup());
    this.outerStream.isStopped.then(() => this.cleanup());
  }

  private async cleanup() {
    await this.stopInnerStream();
    if (this.output && !this.output.isStopped()) {
      await this.output.complete();
    }
  }

  async handle(emission: Emission, stream: Stream): Promise<Emission> {
    if(!this.output) {
      this.output = this.outerStream;
      stream.combine(this, this.outerStream);

      stream.isStopped.then(async () => {
        if (this.activeInnerStream) {
          await this.activeInnerStream.awaitCompletion();
        }
        await this.cleanup();
      });
    }

    if (stream.isCancelled()) {
      emission.isCancelled = true;
      await this.stopInnerStream();
      return emission;
    }

    try {
      return await this.processEmission(emission, stream);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  private async processEmission(emission: Emission, stream: Stream): Promise<Emission> {
    const newInnerStream = this.project(emission.value);

    if (this.activeInnerStream === newInnerStream) {
      emission.isPhantom = true;
      return emission;
    }

    await this.stopInnerStream();
    this.activeInnerStream = newInnerStream;

    this.innerStreamSubscription = newInnerStream.subscribe(async (value) => {
      if (!stream.isCancelled()) {
        await this.output!.emit({ value }, this.next!);
      }
    });

    newInnerStream.isFailed.then((error) => {
      emission.error = error;
      emission.isFailed = true;
      this.removeInnerStream(newInnerStream);
    });

    newInnerStream.isStopped.then(() => {
      this.removeInnerStream(newInnerStream);
    }).catch((error) => {
      emission.error = error;
      emission.isFailed = true;
      this.removeInnerStream(newInnerStream);
    });

    emission.isPhantom = true;
    return new Promise<Emission>((resolve) => {
      newInnerStream.isStopped.then(() => resolve(emission));
    });
  }

  private removeInnerStream(innerStream: Stream) {
    if (this.activeInnerStream === innerStream) {
      this.activeInnerStream = undefined;
    }
  }

  private async stopInnerStream() {
    if (this.activeInnerStream) {
      this.innerStreamSubscription?.unsubscribe();
      this.activeInnerStream.terminate();
      this.removeInnerStream(this.activeInnerStream);
    }
  }
}

export const switchMap = (project: (value: any) => Stream) => new SwitchMapOperator(project);
