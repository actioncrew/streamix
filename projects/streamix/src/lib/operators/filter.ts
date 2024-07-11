import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';


export class FilterOperator extends AbstractOperator {
  private readonly predicate: (value: any) => boolean;

  constructor(predicate: (value: any) => boolean) {
    super();
    this.predicate = predicate;
  }

  async handle(request: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      request.isCancelled = true;
      return request;
    }

    request.isPhantom = !this.predicate(request.value);

    if(!request.isPhantom) {
      return this.next?.process(request, stream) ?? Promise.resolve(request);
    } else {
      return request;
    }
  }
}

export function filter(predicate: (value: any) => boolean) {
  return new FilterOperator(predicate);
}

