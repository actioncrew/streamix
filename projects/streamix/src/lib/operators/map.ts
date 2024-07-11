import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class MapOperator extends AbstractOperator {
  private readonly transform: (value: any) => any;

  constructor(transform: (value: any) => any) {
    super();
    this.transform = transform;
  }

  async handle(request: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      request.isCancelled = true;
      return request;
    }

    try {
      request.value = this.transform(request.value);
      return this.next?.process(request, stream) ?? Promise.resolve(request);
    } catch(error) {
      request.error = error;
      request.isFailed = true;
      stream.isFailed.resolve(error);
      return request;
    }
  }
}

export function map(transform: (value: any) => any) {
  return new MapOperator(transform);
}
