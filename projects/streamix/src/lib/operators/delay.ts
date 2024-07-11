import { AbstractOperator, AbstractStream, Emission } from '../abstractions';

export class DelayOperator extends AbstractOperator {
  private readonly delayTime: number;
  private promiseQueue: Promise<Emission> | undefined;

  constructor(delayTime: number) {
    super();
    this.delayTime = delayTime;
  }

  async handle(request: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      request.isCancelled = true;
      return Promise.resolve(request);
    }

    // Queue up the promise for delay
    this.promiseQueue = this.promiseQueue ?? Promise.resolve(request);
    this.promiseQueue = this.promiseQueue.then(async (emission) => {
      if (stream.isCancelled.value) {
        emission.isCancelled = true;
        return emission;
      }

      return new Promise<Emission>((resolve) => {
        let timeout = setTimeout(() => resolve(emission), this.delayTime);

        stream.isCancelled.promise.then(() => {
          emission.isCancelled = true;
          clearTimeout(timeout);
          resolve(emission);
        });
      });
    });

    return this.promiseQueue.then((emission) => this.next?.process(emission, stream) ?? emission);
  }
}

export function delay(delayTime: number) {
  return new DelayOperator(delayTime);
}
