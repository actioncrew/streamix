import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class ScanOperator extends AbstractOperator {
  private readonly accumulator: (acc: any, value: any) => any;
  private readonly seed: any;
  private accumulatedValue: any;

  constructor(accumulator: (acc: any, value: any) => any, seed: any) {
    super();
    this.accumulator = accumulator;
    this.seed = seed;
    this.accumulatedValue = seed;
  }

  handle(request: Emission, cancellationToken?: boolean): Promise<Emission> {
    if (cancellationToken) {
      return Promise.resolve({ ...request, isCancelled: true });
    }

    this.accumulatedValue = this.accumulator(this.accumulatedValue, request.value!);
    const emission = { value: this.accumulatedValue, isCancelled: false, isPhantom: false, error: undefined };

    return this.next?.handle(emission, cancellationToken) ?? Promise.resolve(emission);
  }
}

export function scan(accumulator: (acc: any, value: any) => any, seed: any) {
  return new ScanOperator(accumulator, seed);
}
