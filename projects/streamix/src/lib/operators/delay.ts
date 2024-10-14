import { Emission, Operator, Subscribable } from '../abstractions';

export class DelayOperator extends Operator {
  private readonly delayTime: number;

  constructor(delayTime: number) {
    super();
    this.delayTime = delayTime;
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {

    // Apply the delay
    await new Promise<Emission>((resolve) => {
      const timeout = setTimeout(() => resolve(emission), this.delayTime);

      stream.awaitCompletion().then(() => {
        emission.isPhantom = true;
        clearTimeout(timeout);
        resolve(emission);
      });
    });

    return emission;
  }
}

export const delay = (delayTime: number) => new DelayOperator(delayTime);
