import { AbstractOperator, AbstractStream, Emission } from '../abstractions';

export class DelayOperator extends AbstractOperator {
  private readonly delayTime: number;
  private promiseQueue: Promise<Emission> | undefined;

  constructor(delayTime: number) {
    super();
    this.delayTime = delayTime;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    try {
      // Queue up the promise for delay
      this.promiseQueue = this.promiseQueue ?? emission
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
    } catch(error) {
      emission.isFailed = true;
      emission.error = error;
      return emission;
    }
  }
}

export function delay(delayTime: number) {
  return new DelayOperator(delayTime);
}
