import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class DelayOperator extends AbstractOperator {
  private readonly delayTime: number;

  constructor(delayTime: number) {
    super();
    this.delayTime = delayTime;
  }

  handle(request: Emission, cancellationToken?: boolean): Promise<Emission> {
    if (cancellationToken) {
      return Promise.resolve({ ...request, isCancelled: true });
    }

    return new Promise<Emission>((resolve) => {
      setTimeout(() => {
        resolve(request);
      }, this.delayTime);
    }).then((emission) => this.next?.handle(emission, cancellationToken) ?? emission);
  }
}

export function delay(delayTime: number) {
  return new DelayOperator(delayTime);
}
