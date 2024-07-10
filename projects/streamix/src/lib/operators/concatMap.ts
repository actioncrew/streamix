import { AbstractOperator, AbstractStream, Emission } from '../abstractions';
import { Promisified } from '../utils/promisified';

export class ConcatMapOperator extends AbstractOperator {
  private readonly project: (value: any) => AbstractStream;
  private queue: Emission[] = [];
  private isProcessing = new Promisified<boolean>(false);
  private isFullfilled = new Promisified<boolean>(false);

  constructor(project: (value: any) => AbstractStream) {
    super();
    this.project = project;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission | AbstractStream> {
    if (stream.isCancelled) {
      emission.isCancelled = true;
      return emission;
    }

    this.queue.push(emission);

    if (!this.isProcessing.value) {
      try {
        await this.processQueue(stream);
      } catch (error) {
        return Promise.reject(error); // Reject the outer promise
      }
      return emission;
    }

    // Return a new stream that will be resolved when this emission is processed
    return new Promise<Emission>((resolve, reject) => {
      if (!this.isFullfilled.value) {
        this.isFullfilled.promise.then(() => {
          this.isFullfilled.reset();
          this.processQueue(stream)
            .then(() => resolve(emission))
            .catch((error) => reject(error));
        }).catch((error) => reject(error)); // Propagate errors from isFulfilled.promise
      }
    });
  }

  private async processQueue(stream: AbstractStream) {
    this.isProcessing.resolve(true);

    while (this.queue.length > 0 && !stream.isCancelled) {
      const emission = this.queue.shift()!;
      const innerStream = this.project(emission.value);

      try {
        await new Promise<void>((resolve, reject) => {
          const subscription = innerStream.subscribe((value) => {
            if (this.next) {
              this.next.process({ value }, stream);
            }
          });

          innerStream.isFailed.promise.then((error) => {
            emission.error = error;
            emission.isFailed = true;
            subscription.unsubscribe();
            reject(error);
          })

          innerStream.isStopped.promise.then(() => {
            resolve();
          });
        });
      } catch (error) {
        emission.error = error;
        emission.isFailed = true;
      }

      if(emission.isFailed) {
        throw emission.error;
      }
    }

    this.isFullfilled.resolve(true);
    this.isProcessing.reset();
  }
}

export function concatMap(project: (value: any) => AbstractStream) {
  return new ConcatMapOperator(project);
}
