import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class TapOperator extends AbstractOperator {
  private readonly tapFunction: (value: any) => void;

  constructor(tapFunction: (value: any) => void) {
    super();
    this.tapFunction = tapFunction;
  }

  handle(request: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled) {
      return Promise.resolve({ ...request, isCancelled: true });
    }

    try {
      this.tapFunction(request.value);
    } catch (error: any) {
      return Promise.resolve({ ...request, error });
    }

    return this.next?.handle(request, stream) ?? Promise.resolve(request);
  }
}

export function tap(tapFunction: (value: any) => void) {
  return new TapOperator(tapFunction);
}
