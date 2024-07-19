import { AbstractOperator, AbstractStream, Emission, StreamSink } from '../abstractions';

export class ConcatMapOperator extends AbstractOperator {
  private readonly project: (value: any) => AbstractStream;
  private outerStream: AbstractStream;
  private currentInnerStream: AbstractStream | null = null;
  private processingPromise: Promise<void> | null = null;
  private queue: Emission[] = [];

  private left?: StreamSink;
  private right?: StreamSink;

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

        this.processingPromise && await this.processingPromise;
      }
    });

    // Handle events for the outer stream
    this.outerStream.isCancelled.then(() => {
      this.stopCurrentInnerStream();
      this.stopLeftStream();
      this.stopRightStream();
    });

    this.outerStream.isFailed.then((error) => {
      console.error('Outer stream failed:', error);
      this.stopCurrentInnerStream();
      this.stopLeftStream();
      this.stopRightStream();
    });

    this.outerStream.isStopped.then(() => {
      this.stopCurrentInnerStream();
      this.stopLeftStream();
      this.stopRightStream();
    });
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    const streamSink = stream instanceof StreamSink ? stream : new StreamSink(stream);
    if (!this.left) [this.left, this.right] = streamSink.split(this, this.outerStream);

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
      await this.processEmission(emission, this.right!);
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
