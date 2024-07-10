import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class SkipOperator extends AbstractOperator {
  private count: number;

  constructor(count: number) {
    super();
    this.count = count;
  }

  handle(request: Emission, stream: AbstractStream): Promise<Emission> {
    if (this.count <= 0) {
      return this.next?.process(request, stream) ?? Promise.resolve(request);
    } else {
      this.count--;
      request.isPhantom = true;
      return Promise.resolve(request);
    }
  }
}

export function skip(count: number) {
  return new SkipOperator(count);
}
