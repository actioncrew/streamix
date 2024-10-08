import { Subject } from '../../lib';
import { Emission, Operator, Subscribable, Subscription } from '../abstractions';

export class SwitchMapOperator extends Operator {
  private project: (value: any) => Subscribable;
  private activeInnerStream?: Subscribable;
  private outerStream = new Subject();
  private innerStreamSubscription?: Subscription;

  constructor(project: (value: any) => Subscribable) {
    super();
    this.project = project;
  }

  private initializeOuterStream() {
    this.outerStream.isCancelled.then(() => this.cleanup());
    this.outerStream.isFailed.then(() => this.cleanup());
    this.outerStream.isStopped.then(() => this.cleanup());
  }

  override init(stream: Subscribable) {
    this.initializeOuterStream();

    stream.isStopped.then(async () => {
      if (this.activeInnerStream) {
        await this.activeInnerStream.awaitCompletion();
      }
      await this.cleanup();
    });
  }

  override async cleanup() {
    await this.stopInnerStream();
    if (this.outerStream && !this.outerStream.isStopped()) {
      await this.outerStream.complete();
    }
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {

    if (stream.isCancelled()) {
      emission.isCancelled = true;
      await this.stopInnerStream();
      return emission;
    }

    try {
      return await this.processEmission(emission, this.outerStream);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  private async processEmission(emission: Emission, stream: Subject): Promise<Emission> {
    const newInnerStream = this.project(emission.value);

    if (this.activeInnerStream === newInnerStream) {
      emission.isPhantom = true;
      return emission;
    }

    await this.stopInnerStream();
    this.activeInnerStream = newInnerStream;

    this.innerStreamSubscription = this.activeInnerStream.subscribe(async (value) => {
      if (!stream.shouldTerminate() && !stream.shouldComplete()) {
        await stream.next(value);
      }
    });

    this.activeInnerStream.isFailed.then((error) => {
      emission.error = error;
      emission.isFailed = true;
      this.removeInnerStream(this.activeInnerStream!);
    });

    this.activeInnerStream.isStopped.then(() => {
      this.removeInnerStream(this.activeInnerStream!);
    }).catch((error) => {
      emission.error = error;
      emission.isFailed = true;
      this.removeInnerStream(this.activeInnerStream!);
    });

    emission.isPhantom = true;
    return new Promise<Emission>((resolve) => {
      this.activeInnerStream!.isStopped.then(() => resolve(emission));
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
