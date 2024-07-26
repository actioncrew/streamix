import { AbstractOperator, AbstractStream, Emission } from '../abstractions';

export class ConcatMapOperator extends AbstractOperator {
  private readonly project: (value: any) => AbstractStream;
  private outerStream: AbstractStream;
  private currentInnerStream: AbstractStream | null = null;
  private processingPromise: Promise<void> | null = null;
  private queue: Emission[] = [];

  private innerSink?: AbstractStream;
  private outerSink?: AbstractStream;

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

        await this.processingPromise;
      }
    });

    // Handle events for the outer stream
    this.outerStream.isCancelled.then(() => {
      this.stopCurrentInnerStream();
      this.stopLeftStream();
      this.stopRightStream();
    });

    this.outerStream.isFailed.then((error) => {
      console.warn('Outer stream failed:', error);
      this.stopCurrentInnerStream();
      this.stopLeftStream();
      this.stopRightStream();
    });

    this.outerStream.isStopRequested.then(() => {
      this.stopCurrentInnerStream();
      this.stopLeftStream();
      this.stopRightStream();
    });
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (!this.innerSink) { this.innerSink = stream; }
    if (!this.outerSink) { this.outerSink = this.innerSink.split(this, this.outerStream); }

    try {
      this.queue.push(emission);

      if(!this.processingPromise) {
        this.processingPromise = this.processQueue();
        await this.processingPromise;
        this.processingPromise = null;
      }

      return emission;
    } catch (error) {
      emission.error = error;
      emission.isFailed = true;
      return emission;
    }
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && !this.currentInnerStream) {
      const emission = this.queue.shift()!;
      await this.processEmission(emission, this.outerSink!);
    }
  }

  private async processEmission(emission: Emission, stream: AbstractStream): Promise<void> {
    if (await this.checkAndStopStream(stream, emission)) {
      return;
    }

    const innerStream = this.project(emission.value);
    this.currentInnerStream = innerStream;

    return new Promise<void>((resolve) => {
      const handleCompletion = () => {
        this.currentInnerStream = null;
        resolve();
        this.processQueue();
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
  }

  private async stopCurrentInnerStream() {
    if (this.currentInnerStream) {
      await this.currentInnerStream.complete();
      this.currentInnerStream = null;
    }
  }

  private async stopLeftStream() {
    if (this.innerSink) {
      await this.innerSink.complete();
    }
  }

  private async stopRightStream() {
    if (this.outerSink) {
      await this.outerSink.complete();
    }
  }

  private async checkAndStopStream(stream: AbstractStream, emission: Emission): Promise<boolean> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      await this.stopCurrentInnerStream();
      await this.stopLeftStream();
      await this.stopRightStream();
      return true;
    }
    return false;
  }
}

export function concatMap(project: (value: any) => AbstractStream) {
  return new ConcatMapOperator(project);
}
