import { counter, Subject } from '../../lib';
import { Emission, Operator, Subscribable } from '../abstractions';

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
    this.initializeOuterStream();
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    this.emissionNumber++;


    this.output = this.output || this.outerStream;

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

  private async processEmission(emission: Emission, stream: Subject): Promise<void> {
    if (await this.checkAndStopStream(stream, emission)) return;

    this.innerStream = this.project(emission.value);
    await this.handleInnerStream(emission, stream);
  }

  private async handleInnerStream(emission: Emission, stream: Subject): Promise<void> {

    return new Promise<void>((resolve) => {
      const handleCompletion = async () => {
        this.innerStream = null;
        this.executionNumber.increment();
        await this.processQueue();
        resolve();
      };

      const subscription = this.innerStream!.subscribe(async (value) => {
        if (!stream.shouldTerminate() && !stream.shouldComplete()) {
          await stream.next(value);
        }
      });

      this.innerStream!.isFailed.then((error) => this.handleStreamError(emission, error, handleCompletion));

      this.innerStream!.isStopped.then(() => {
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

  override async cleanup() {
    await this.stopStreams(this.innerStream, this.input, this.output);
  }

  private async stopStreams(...streams: (Subscribable | null | undefined)[]) {
    await Promise.all(streams.filter(Boolean).map(stream => stream!.complete()));
  }

  private async checkAndStopStream(stream: Subscribable, emission: Emission): Promise<boolean> {
    if (stream.isCancelled()) {
      emission.isCancelled = true;
      await this.stopStreams(this.innerStream, this.input, this.output);
      return true;
    }
    return false;
  }
}

export const concatMap = (project: (value: any) => Subscribable) => new ConcatMapOperator(project);
