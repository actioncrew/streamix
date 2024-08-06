import { Subject } from '../../lib';
import { Emission, Operator, Stream, Subscribable } from '../abstractions';
import { promisifiedCounter } from '../utils';

export class MergeMapOperator extends Operator {
  private readonly project: (value: any) => Subscribable;
  private outerStream = new Subject();
  private activeInnerStreams: Subscribable[] = [];
  private processingPromises: Promise<void>[] = [];

  private input?: Subscribable;
  private output?: Stream;
  private counter = promisifiedCounter(0);

  constructor(project: (value: any) => Subscribable) {
    super();
    this.project = project;

    // Handle events for the outer stream
    this.outerStream.isCancelled.then(() => {
      this.stopAllStreams();
    });

    this.outerStream.isFailed.then((error) => {
      console.warn('Outer stream failed:', error);
      this.stopAllStreams();
    });

    this.outerStream.isStopped.then(() => {
      this.stopAllStreams();
    });
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    this.output = this.output || this.outerStream;

    if (!this.input) {
      this.input = stream;
      this.input.isStopped.then(() => this.counter.waitFor(0).then(() => this.output?.complete()));
    }

    return this.processEmission(emission, this.output!);
  }

  private async processEmission(emission: Emission, stream: Stream): Promise<Emission> {
    if (await this.checkAndStopStream(stream, emission)) {
      return emission;
    }

    const innerStream = this.project(emission.value);
    this.activeInnerStreams.push(innerStream);
    this.counter.increment();

    const processingPromise = new Promise<void>((resolve) => {
      const handleCompletion = () => {
        this.removeInnerStream(innerStream);
        this.counter.decrement();
        resolve();
      };

      const subscription = innerStream.subscribe(async (value) => {
        if (!stream.shouldTerminate() && !stream.shouldComplete()) {
          await stream.emit({ value }, stream.head!);
        }
      });

      innerStream.isCancelled.then(() => {
        emission.isCancelled = true;
        subscription.unsubscribe();
        handleCompletion();
      });

      innerStream.isFailed.then((error) => {
        emission.error = error;
        emission.isFailed = true;
        subscription.unsubscribe();
        handleCompletion();
      });

      innerStream.isStopped.then(() => {
        subscription.unsubscribe();
        emission.isComplete = true;
        handleCompletion();
      }).catch((error) => {
        emission.error = error;
        emission.isFailed = true;
        handleCompletion();
      });
    });

    this.processingPromises.push(processingPromise);

    Promise.race([stream.awaitCompletion(), stream.awaitTermination()]).then(() => {
      this.stopAllStreams();
    });

    emission.isPhantom = true;

    return new Promise<Emission>((resolve) => {
      processingPromise.then(() => resolve(emission));
    });
  }

  private removeInnerStream(innerStream: Subscribable) {
    const index = this.activeInnerStreams.indexOf(innerStream);
    if (index !== -1) {
      this.activeInnerStreams.splice(index, 1);
    }
  }

  private async stopAllStreams() {
    await Promise.all(this.activeInnerStreams.map(async (stream) => {
      await stream.complete();
    }));
    this.activeInnerStreams = [];
    await this.stopInputStream();
    await this.stopOutputStream();
  }

  private async stopInputStream() {
    if (this.input) {
      await this.input.complete();
    }
  }

  private async stopOutputStream() {
    if (this.output) {
      await this.output.complete();
    }
  }

  private async checkAndStopStream(stream: Subscribable, emission: Emission): Promise<boolean> {
    if (stream.isCancelled()) {
      emission.isCancelled = true;
      await this.stopAllStreams();
      return true;
    }
    return false;
  }
}

export const mergeMap = (project: (value: any) => Subscribable) => new MergeMapOperator(project);
