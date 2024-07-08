import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class TapOperator extends AbstractOperator {
  private readonly tapFunction: (value: any) => void;

  constructor(tapFunction: (value: any) => void) {
    super();
    this.tapFunction = tapFunction;
  }

  handle(request: Emission, cancellationToken?: boolean): Promise<Emission> {
    if (cancellationToken) {
      return Promise.resolve({ ...request, isCancelled: true });
    }

    try {
      this.tapFunction(request.value);
    } catch (error: any) {
      return Promise.resolve({ ...request, error });
    }

    return this.next?.handle(request, cancellationToken) ?? Promise.resolve(request);
  }
}

export function tap(tapFunction: (value: any) => void) {
  return new TapOperator(tapFunction);
}
