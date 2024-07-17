import { AbstractOperator, AbstractStream, Emission } from '../abstractions';

export class DelayOperator extends AbstractOperator {
  private readonly delayTime: number;
  private promiseQueue: Promise<Emission> | undefined;

  constructor(delayTime: number) {
    super();
    this.delayTime = delayTime;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    // Queue up the promise for delay
    this.promiseQueue = this.promiseQueue ?? Promise.resolve(emission);
    this.promiseQueue = this.promiseQueue.then(async (currentEmission) => {
      if (stream.isCancelled.value) {
        currentEmission.isCancelled = true;
        return currentEmission;
      }

      return new Promise<Emission>((resolve) => {
        const timeout = setTimeout(() => resolve(currentEmission), this.delayTime);

        stream.isCancelled.then(() => {
          currentEmission.isCancelled = true;
          clearTimeout(timeout);
          resolve(currentEmission);
        });
      });
    });

    const delayedEmission = await this.promiseQueue;
    return delayedEmission;
  }
}

export function delay(delayTime: number) {
  return new DelayOperator(delayTime);
}
