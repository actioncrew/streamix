import { Subject } from '../../lib';
import { Emission, Operator, Stream, Subscribable, Subscription } from '../abstractions';

export class SwitchMapOperator extends Operator {
  private project: (value: any) => Subscribable;
  private activeInnerStream?: Subscribable;
  private outerStream = new Subject();
  private output?: Stream;
  private innerStreamSubscription?: Subscription;

  constructor(project: (value: any) => Subscribable) {
    super();
    this.project = project;
    this.initializeOuterStream();
  }

  private initializeOuterStream() {
    this.outerStream.isCancelled.then(() => this.cleanup());
    this.outerStream.isFailed.then(() => this.cleanup());
    this.outerStream.isStopped.then(() => this.cleanup());
  }

  override async cleanup() {
    await this.stopInnerStream();
    if (this.output && !this.output.isStopped()) {
      await this.output.complete();
    }
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    if(!this.output) {
      this.output = this.outerStream;

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
      return await this.processEmission(emission, this.output);
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
      if (!stream.shouldTerminate() && !stream.shouldComplete()) {
        await stream.emit({ value }, stream.head!);
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

  private removeInnerStream(innerStream: Subscribable) {
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

export const switchMap = (project: (value: any) => Subscribable) => new SwitchMapOperator(project);
