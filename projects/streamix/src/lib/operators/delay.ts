import { Emission, Operator, Subscribable } from '../abstractions';

export class DelayOperator extends Operator {
  private readonly delayTime: number;
  private promiseQueue: Promise<Emission> | undefined;

  constructor(delayTime: number) {
    super();
    this.delayTime = delayTime;
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    // Queue up the promise for delay
    this.promiseQueue = this.promiseQueue ?? Promise.resolve(emission);
    this.promiseQueue = this.promiseQueue.then(async (currentEmission) => {
      if (stream.isCancelled()) {
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

export const delay = (delayTime: number) => new DelayOperator(delayTime);
