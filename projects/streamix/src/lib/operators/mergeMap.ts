import { AbstractOperator, AbstractStream, Emission } from '../abstractions';
import { PromisifiedCounter } from '../utils/counter';

export class MergeMapOperator extends AbstractOperator {
  private readonly project: (value: any) => AbstractStream;
  private outerStream: AbstractStream;
  private activeInnerStreams: AbstractStream[] = [];
  private processingPromises: Promise<void>[] = [];

  private input?: AbstractStream;
  private output?: AbstractStream;
  private counter = new PromisifiedCounter(0);

  constructor(project: (value: any) => AbstractStream) {
    super();
    this.project = project;
    this.outerStream = new AbstractStream();

    Object.assign(this.outerStream, {
      run: async () => {
        await Promise.race([
          this.outerStream.awaitCompletion(),
          this.outerStream.awaitTermination()
        ]);
        await Promise.all(this.processingPromises);
      }
    });

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

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    this.input = this.input || stream;
    this.output = this.output || stream.combine(this, this.outerStream);

    return this.processEmission(emission, this.output!);
  }

  private async processEmission(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (await this.checkAndStopStream(stream, emission)) {
      return emission;
    }

    const innerStream = this.project(emission.value);
    this.activeInnerStreams.push(innerStream);
    this.counter.increment();

    const processingPromise = new Promise<void>((resolve) => {
      const handleCompletion = () => {
        this.removeInnerStream(innerStream);
        resolve();
      };

      const subscription = innerStream.subscribe(async (value) => {
        if (!stream.shouldTerminate()) {
          await stream.emit({ value });
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

    this.counter.subscribe(() => {
      if (stream.shouldComplete() || stream.shouldTerminate()) {
        this.stopAllStreams();
      }
    });

    emission.isPhantom = true;

    return new Promise<Emission>((resolve) => {
      processingPromise.then(() => resolve(emission));
    });
  }

  private removeInnerStream(innerStream: AbstractStream) {
    const index = this.activeInnerStreams.indexOf(innerStream);
    if (index !== -1) {
      this.activeInnerStreams.splice(index, 1);
      this.counter.decrement();
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

  private async checkAndStopStream(stream: AbstractStream, emission: Emission): Promise<boolean> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      await this.stopAllStreams();
      return true;
    }
    return false;
  }
}

export const mergeMap = (project: (value: any) => AbstractStream) => new MergeMapOperator(project);
