import { AbstractOperator, AbstractStream, Emission, StreamSink } from '../abstractions';

export class ConcatMapOperator extends AbstractOperator {
  private readonly project: (value: any) => AbstractStream;
  private queue: Emission[] = [];

  private left!: StreamSink;
  private right!: StreamSink;

  constructor(project: (value: any) => AbstractStream) {
    super();
    this.project = project;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {

    const streamSink = stream instanceof StreamSink ? stream : new StreamSink(stream);
    if (!this.left) [this.left, this.right] = streamSink.split(this, streamSink);

    this.queue.push(emission);
    await this.processQueue(this.right);

    emission.isPhantom = true;
    return emission;
  }

  private async processQueue(stream: AbstractStream): Promise<void> {
    while (this.queue.length > 0) {
      const emission = this.queue.shift()!;
      if(!stream.isCancelled.value && !stream.isUnsubscribed.value) {
        const innerStream = this.project(emission.value);

        try {
          await this.processInnerStream(emission, innerStream, stream);
        } catch (error) {
          emission.error = error;
          emission.isFailed = true;
        }
      }
      else if (stream.isCancelled.value) {
        emission.isCancelled = true;
      }
    }
  }

  private async processInnerStream(emission: Emission, innerStream: AbstractStream, stream: AbstractStream): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const subscription = innerStream.subscribe(async (value) => {
        if(!stream.isCancelled.value && !stream.isUnsubscribed.value) {
          await stream.emit({ value }).catch(reject);
        }
      });

      innerStream.isCancelled.then(() => {
        emission.isCancelled = true;
        subscription.unsubscribe();
        resolve();
      });

      innerStream.isFailed.then((error) => {
        subscription.unsubscribe();
        emission.isFailed = true;
        emission.error = error;
        reject(error);
      });

      innerStream.isStopped.then(() => {
        subscription.unsubscribe();
        resolve();
      }).catch(reject);

      // Handle stream cancellation and stop requests
      stream.isCancelled.then(() => {
        subscription.unsubscribe();
        resolve();
      });
      stream.isStopRequested.then(() => {
        subscription.unsubscribe();
        resolve();
      });
    });
  }
}

export function concatMap(project: (value: any) => AbstractStream) {
  return new ConcatMapOperator(project);
}
