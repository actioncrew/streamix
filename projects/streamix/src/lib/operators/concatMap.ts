import { AbstractOperator, AbstractStream, Emission } from '../abstractions';

export class ConcatMapOperator extends AbstractOperator {
  private readonly project: (value: any) => AbstractStream;
  private outerStream: AbstractStream;
  private currentInnerStream: AbstractStream | null = null;
  private processingPromise: Promise<void> | null = null;
  private queue: Emission[] = [];

  private input?: AbstractStream;
  private output?: AbstractStream;

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
      this.stopInputStream();
      this.stopOutputStream();
    });

    this.outerStream.isFailed.then((error) => {
      console.warn('Outer stream failed:', error);
      this.stopCurrentInnerStream();
      this.stopInputStream();
      this.stopOutputStream();
    });

    this.outerStream.isStopRequested.then(() => {
      this.stopCurrentInnerStream();
      this.stopInputStream();
      this.stopOutputStream();
    });
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (!this.input) { this.input = stream; }
    if (!this.output) { this.output = stream.combine(this, this.outerStream); }

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
      await this.processEmission(emission, this.output!);
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
        this.stopInputStream();
        this.stopOutputStream();
        handleCompletion();
      });

      innerStream.isFailed.then((error) => {
        emission.error = error;
        emission.isFailed = true;
        subscription.unsubscribe();
        this.stopInputStream();
        this.stopOutputStream();
        handleCompletion();
      });

      innerStream.isStopped.then(() => {
        subscription.unsubscribe();
        emission.isComplete = true;
        this.stopInputStream();
        this.stopOutputStream();
        handleCompletion();
      }).catch((error) => {
        emission.error = error;
        emission.isFailed = true;
        this.stopInputStream();
        this.stopOutputStream();
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
      await this.stopCurrentInnerStream();
      await this.stopInputStream();
      await this.stopOutputStream();
      return true;
    }
    return false;
  }
}

export function concatMap(project: (value: any) => AbstractStream) {
  return new ConcatMapOperator(project);
}
