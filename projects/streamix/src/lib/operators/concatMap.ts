import { Emission, Operator, Stream } from '../abstractions';

export class ConcatMapOperator extends Operator {
  private readonly project: (value: any) => Stream;
  private outerStream: Stream;
  private innerStream: Stream | null = null;
  private processingPromise: Promise<void> | null = null;
  private executionNumber: number = 0;
  private emissionNumber: number = 0;
  private queue: Emission[] = [];
  private input?: Stream;
  private output?: Stream;

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
      await this.processingPromise;
    };

    this.outerStream.isCancelled.then(() => this.cleanup());
    this.outerStream.isFailed.then(() => this.cleanup());
    this.outerStream.isStopRequested.then(() => this.cleanup());
  }

  async handle(emission: Emission, stream: Stream): Promise<Emission> {
    this.input = this.input || stream;
    this.output = this.output || stream.combine(this.outerStream);

    this.emissionNumber++;
    this.queue.push(emission);
    this.processingPromise = this.processingPromise || this.processQueue();
    await this.processingPromise;
    this.processingPromise = null;

    emission.isPhantom = true;
    return emission;
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && !this.innerStream) {
      await this.processEmission(this.queue.shift()!, this.output!);
    }
  }

  private async processEmission(emission: Emission, stream: Stream): Promise<void> {
    if (await this.checkAndStopStream(stream, emission)) return;

    this.innerStream = this.project(emission.value);
    await this.handleInnerStream(emission, stream);
  }

  private async handleInnerStream(emission: Emission, stream: Stream): Promise<void> {
    return new Promise<void>((resolve) => {
      const handleCompletion = async () => {
        this.executionNumber--; // Decrement the counter when the innerStream completes

        if (this.executionNumber === this.emissionNumber) {
          await this.input?.complete();
          await this.output?.complete();
          resolve();
        } else {
          this.innerStream = null;
          await this.processQueue();
          resolve();
        }
      };

      const subscription = this.innerStream!.subscribe(async (value) => {
        if (!stream.shouldTerminate() && !stream.shouldComplete()) {
          await stream.emit({ value }, stream.head!);
        }
      });

      this.innerStream!.isFailed.then((error) => this.handleStreamError(emission, error, handleCompletion));

      this.innerStream!.isStopped.then(() => {
        this.executionNumber++;
        subscription.unsubscribe();
        emission.isComplete = true;
        handleCompletion();
      }).catch((error) => this.handleStreamError(emission, error, handleCompletion));
    });
  }

  private handleStreamError(emission: Emission, error: any, callback: () => void) {
    emission.error = error;
    emission.isFailed = true;
    this.stopStreams(this.input, this.output);
    callback();
  }

  private async cleanup() {
    await this.stopStreams(this.innerStream, this.input, this.output);
  }

  private async stopStreams(...streams: (Stream | null | undefined)[]) {
    await Promise.all(streams.filter(Boolean).map(stream => stream!.complete()));
  }

  private async checkAndStopStream(stream: Stream, emission: Emission): Promise<boolean> {
    if (stream.isCancelled()) {
      emission.isCancelled = true;
      await this.stopStreams(this.innerStream, this.input, this.output);
      return true;
    }
    return false;
  }
}

export const concatMap = (project: (value: any) => Stream) => new ConcatMapOperator(project);
