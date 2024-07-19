import { AbstractOperator, AbstractStream, Emission, StreamSink } from '../abstractions';
import { PromisifiedCounter } from '../utils/counter';

export class MergeMapOperator extends AbstractOperator {
  private readonly project: (value: any) => AbstractStream;
  private outerStream: AbstractStream;
  private activeInnerStreams: AbstractStream[] = [];
  private processingPromises: Promise<void>[] = [];

  private left?: StreamSink;
  private right?: StreamSink;

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
      this.stopInnerStreams();
      this.stopLeftStream();
      this.stopRightStream();
    });

    this.outerStream.isFailed.then((error) => {
      console.error('Outer stream failed:', error);
      this.stopInnerStreams();
      this.stopLeftStream();
      this.stopRightStream();
    });

    this.outerStream.isStopped.then(() => {
      this.stopInnerStreams();
      this.stopLeftStream();
      this.stopRightStream();
    });
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    const streamSink = stream instanceof StreamSink ? stream : new StreamSink(stream);
    if (!this.left) [this.left, this.right] = streamSink.split(this, streamSink);

    try {
      return await this.processEmission(emission, this.right!);
    } catch (error) {
      emission.error = error;
      emission.isFailed = true;
      return emission;
    }
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
        this.stopLeftStream();
        this.stopRightStream();
        handleCompletion();
      });

      innerStream.isFailed.then((error) => {
        emission.error = error;
        emission.isFailed = true;
        subscription.unsubscribe();
        this.stopLeftStream();
        this.stopRightStream();
        handleCompletion();
      });

      innerStream.isStopped.then(() => {
        subscription.unsubscribe();
        emission.isComplete = true;
        this.stopLeftStream();
        this.stopRightStream();
        handleCompletion();
      }).catch((error) => {
        emission.error = error;
        emission.isFailed = true;
        this.stopLeftStream();
        this.stopRightStream();
        handleCompletion();
      });
    });

    this.processingPromises.push(processingPromise);

    this.counter.subscribe(() => {
      if (stream.shouldComplete() || stream.shouldTerminate()) {
        this.stopInnerStreams();
        this.stopLeftStream();
        this.stopRightStream();
        this.left?.isStopRequested.resolve(true);
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

  private async stopInnerStreams() {
    await Promise.all(this.activeInnerStreams.map(async (stream) => {
      await stream.complete();
    }));
    this.activeInnerStreams = [];
  }

  private async stopLeftStream() {
    if (this.left) {
      await this.left.complete();
    }
  }

  private async stopRightStream() {
    if (this.right) {
      await this.right.complete();
    }
  }

  private async checkAndStopStream(stream: AbstractStream, emission: Emission): Promise<boolean> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      await this.stopInnerStreams();
      await this.stopLeftStream();
      await this.stopRightStream();
      return true;
    }
    return false;
  }
}

export function mergeMap(project: (value: any) => AbstractStream) {
  return new MergeMapOperator(project);
}
