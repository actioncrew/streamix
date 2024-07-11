import { AbstractOperator, AbstractStream, Emission } from '../abstractions';

export class DelayOperator extends AbstractOperator {
  private readonly delayTime: number;
  private isCancelled: boolean = false;
  private timeoutId?: any;

  constructor(delayTime: number) {
    super();
    this.delayTime = delayTime;
  }

  handle(request: Emission, stream: AbstractStream): Promise<Emission> {
    return new Promise<Emission>((resolve) => {
      if (this.isCancelled) {
        request.isCancelled = true;
        resolve(request);
        return;
      }

      this.timeoutId = setTimeout(() => {
        resolve(request);
      }, this.delayTime);

      stream.isCancelled.promise.then(() => {
        this.cancel(); // Cancel operation if stream is cancelled
        resolve(request);
      });
    }).then((emission) => this.next?.process(emission, stream) ?? emission);
  }

  cancel(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    this.isCancelled = true;
  }
}

export function delay(delayTime: number) {
  return new DelayOperator(delayTime);
}
