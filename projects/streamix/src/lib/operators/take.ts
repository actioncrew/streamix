import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class TakeOperator extends AbstractOperator {
  private count: number;
  private emittedCount: number = 0;

  constructor(count: number) {
    super();
    this.count = count;
  }

  handle(request: Emission): Promise<Emission> {
    if (this.emittedCount < this.count) {
      this.emittedCount++;
      return this.next ? this.next.handle(request) : Promise.resolve(request);
    } else {
      return Promise.resolve({ ...request, isPhantom: true });
    }
  }
}

export function take(count: number) {
  return new TakeOperator(count);
}
