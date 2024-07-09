import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';


export class FilterOperator extends AbstractOperator {
  private readonly predicate: (value: any) => boolean;

  constructor(predicate: (value: any) => boolean) {
    super();
    this.predicate = predicate;
  }

  handle(request: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled) {
      request.isCancelled = true;
      return Promise.resolve(request);
    }

    request.isPhantom = !this.predicate(request.value);

    if(!request.isPhantom) {
      return this.next ? this.next.handle(request, stream) : Promise.resolve(request);
    } else {
      return Promise.resolve(request);
    }
  }
}

export function filter(predicate: (value: any) => boolean) {
  return new FilterOperator(predicate);
}

