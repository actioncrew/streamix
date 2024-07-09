import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class MapOperator extends AbstractOperator {
  private readonly transform: (value: any) => any;

  constructor(transform: (value: any) => any) {
    super();
    this.transform = transform;
  }

  handle(request: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled) {
      return Promise.resolve({ ...request, isCancelled: true });
    }

    const transformedValue = this.transform(request.value!);
    return this.next?.handle({ value: transformedValue, isCancelled: false, isPhantom: false, error: undefined }, stream) ?? Promise.resolve({ value: transformedValue, isCancelled: false, isPhantom: false, error: undefined });
  }
}

export function map(transform: (value: any) => any) {
  return new MapOperator(transform);
}
