import { AbstractOperator, AbstractStream, Emission, StreamSink } from '../abstractions';
import { Promisified } from '../utils/promisified';

export class ConcatMapOperator extends AbstractOperator {
  private readonly project: (value: any) => AbstractStream;
  private queue: Emission[] = [];
  private isProcessing = new Promisified<boolean>(false);

  private left!: StreamSink;
  private right!: StreamSink;

  constructor(project: (value: any) => AbstractStream) {
    super();
    this.project = project;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    this.queue.push(emission);

    if (!this.isProcessing.value) {
      this.isProcessing.resolve(true);
      await this.processQueue(stream);
      this.isProcessing.reset();
    }

    emission.isPhantom = true;
    return emission;
  }

  private async processQueue(stream: AbstractStream): Promise<void> {
    while (this.queue.length > 0 && !stream.isCancelled.value) {
      const emission = this.queue.shift()!;
      const innerStream = this.project(emission.value);

      let streamSink = stream as StreamSink;
      if (!(streamSink instanceof StreamSink)) {
        streamSink = new StreamSink(streamSink);
      }
      if (this.left === undefined) {
        const [left, right] = streamSink.split(this, streamSink);
        this.left = left;
        this.right = right;
      }

      try {
        await this.processInnerStream(innerStream, stream);
      } catch (error) {
        emission.error = error;
        emission.isFailed = true;
      }
    }
  }

  private async processInnerStream(innerStream: AbstractStream, stream: AbstractStream): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const subscription = innerStream.subscribe(async (value) => {
        await this.right.emit({ value }).catch(reject);
      });

      innerStream.isFailed.promise.then((error) => {
        subscription.unsubscribe();
        reject(error);
      });

      innerStream.isStopped.promise.then(() => {
        subscription.unsubscribe();
        resolve();
      }).catch(reject);
    });
  }
}

export function concatMap(project: (value: any) => AbstractStream) {
  return new ConcatMapOperator(project);
}
