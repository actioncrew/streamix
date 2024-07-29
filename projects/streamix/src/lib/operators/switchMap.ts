import { AbstractOperator, AbstractStream, Emission, Subscription } from '../abstractions';

export class SwitchMapOperator extends AbstractOperator {
  private project: (value: any) => AbstractStream;
  private activeInnerStream?: AbstractStream;
  private outerStream: AbstractStream;
  private output?: AbstractStream;
  private innerStreamSubscription?: Subscription;

  constructor(project: (value: any) => AbstractStream) {
    super();
    this.project = project;
    this.outerStream = new AbstractStream();
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
      await this.cleanup();
    };

    this.outerStream.isCancelled.then(() => this.cleanup());
    this.outerStream.isStopped.then(() => this.cleanup());
  }

  private async cleanup() {
    await this.stopInnerStream();
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    this.output = this.output || stream.combine(this, this.outerStream);

    if (stream.isCancelled.value) {
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

  private async processEmission(emission: Emission, stream: AbstractStream): Promise<Emission> {
    const newInnerStream = this.project(emission.value);

    if (this.activeInnerStream === newInnerStream) {
      emission.isPhantom = true;
      return emission;
    }

    await this.stopInnerStream();
    this.activeInnerStream = newInnerStream;

    this.innerStreamSubscription = newInnerStream.subscribe(async (value) => {
      if (!stream.isCancelled.value) {
        await this.output!.emit({ value });
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

  private removeInnerStream(innerStream: AbstractStream) {
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

export const switchMap = (project: (value: any) => AbstractStream) => new SwitchMapOperator(project);
