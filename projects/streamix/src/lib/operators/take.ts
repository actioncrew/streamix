import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class TakeOperator extends AbstractOperator {
  private count: number;
  private emittedCount: number = 0;

  constructor(count: number) {
    super();
    this.count = count;
  }

  handle(request: Emission, stream: AbstractStream): Promise<Emission> {
    if (this.emittedCount < this.count) {
      this.emittedCount++;
      let promise = this.next ? this.next.handle(request, stream) : Promise.resolve(request);
      if(this.emittedCount === this.count) {
        stream.complete();
      }
      return promise;
    } else {
      request.isPhantom = true;
      return Promise.resolve(request);
    }
  }
}

export function take(count: number) {
  return new TakeOperator(count);
}
