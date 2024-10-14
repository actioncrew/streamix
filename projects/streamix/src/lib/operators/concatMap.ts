import { Operator, Subscribable, Emission } from '../abstractions';
import { Subject, counter } from '../../lib';

export class ConcatMapOperator extends Operator {
  private readonly project: (value: any) => Subscribable;
  private outerStream = new Subject();
  private innerStream: Subscribable | null = null;
  private processingPromise: Promise<void> | null = null;
  private queue: Emission[] = [];
  private input?: Subscribable;
  private output?: Subject;
  private emissionNumber = 0;
  private executionNumber = counter(0);
  private handleInnerEmission: (({ emission, source }: any) => Promise<void>) | null = null;

  constructor(project: (value: any) => Subscribable) {
    super();
    this.project = project;
  }

  private initializeOuterStream() {
    this.outerStream.isCancelled.then(() => this.cleanup());
    this.outerStream.isFailed.then(() => this.cleanup());
    this.outerStream.isStopRequested.then(() => this.cleanup());
  }

  override init(stream: Subscribable) {
    this.input = stream;
    this.input.isStopped.then(() => this.executionNumber.waitFor(this.emissionNumber)).then(() => this.cleanup());
    this.output = this.outerStream;
    this.initializeOuterStream();
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    this.emissionNumber++;
    this.queue.push(emission);

    // Ensure processing continues if not already in progress
    this.processingPromise = this.processingPromise || this.processQueue();
    await this.processingPromise;
    this.processingPromise = null;

    emission.isPhantom = true;
    return emission;
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && !this.innerStream) {
      const nextEmission = this.queue.shift();
      if (nextEmission && this.output) {
        await this.processEmission(nextEmission, this.output);
      }
    }
  }

  private async processEmission(emission: Emission, stream: Subject): Promise<void> {
    if (await this.checkAndStopStream(stream, emission)) return;

    this.innerStream = this.project(emission.value);
    await this.handleInnerStream(emission, stream);
  }

  private async handleInnerStream(emission: Emission, stream: Subject): Promise<void> {
    return new Promise<void>((resolve) => {
      const handleCompletion = async () => {
        if (this.innerStream && this.handleInnerEmission) {
          this.innerStream.onEmission.remove(this, this.handleInnerEmission);
        }
        this.innerStream = null;
        this.handleInnerEmission = null;
        this.executionNumber.increment();

        // Continue with the next emission in the queue
        await this.processQueue();
        resolve();
      };

      this.handleInnerEmission = async ({ emission: innerEmission }) => {
        if (!stream.shouldComplete()) {
          await stream.next(innerEmission.value);
        }
      };

      this.innerStream!.onEmission.chain(this, this.handleInnerEmission);

      this.innerStream!.isFailed.then((error) => this.handleStreamError(emission, error, handleCompletion));

      this.innerStream!.isStopped.then(() => {
        emission.isComplete = true;
        handleCompletion();
      }).catch((error) => this.handleStreamError(emission, error, handleCompletion));

      // Start inner stream processing
      this.innerStream!.start();
    });
  }

  private handleStreamError(emission: Emission, error: any, callback: () => void) {
    emission.error = error;
    emission.isFailed = true;
    this.stopStreams(this.input, this.output);
    callback();
  }

  override async cleanup() {
    if (this.innerStream && this.handleInnerEmission) {
      this.innerStream.onEmission.remove(this, this.handleInnerEmission);
    }
    await this.stopStreams(this.innerStream, this.input, this.output);
    this.innerStream = null;
    this.handleInnerEmission = null;
  }

  private async stopStreams(...streams: (Subscribable | null | undefined)[]) {
    await Promise.all(streams.filter(Boolean).map(stream => stream!.complete()));
  }

  private async checkAndStopStream(stream: Subscribable, emission: Emission): Promise<boolean> {
    if (stream.isCancelled()) {
      emission.isPhantom = true;
      await this.stopStreams(this.innerStream, this.input, this.output);
      return true;
    }
    return false;
  }
}

export const concatMap = (project: (value: any) => Subscribable) => new ConcatMapOperator(project);
