import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class DelayOperator extends AbstractOperator {
  private readonly delayTime: number;

  constructor(delayTime: number) {
    super();
    this.delayTime = delayTime;
  }

  handle(request: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled) {
      return Promise.resolve({ ...request, isCancelled: true });
    }

    return new Promise<Emission>((resolve) => {
      setTimeout(() => {
        resolve(request);
      }, this.delayTime);
    }).then((emission) => this.next?.process(emission, stream) ?? emission);
  }
}

export function delay(delayTime: number) {
  return new DelayOperator(delayTime);
}
