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
      return Promise.resolve({ ...request, isCancelled: true });
    }

    const result = this.predicate(request.value);
    const value = result ? request.value : undefined;
    const isPhantom = !result;
    const emission: Emission = { value, isCancelled: false, isPhantom, error: undefined };

    if(isPhantom) {
      return Promise.resolve(emission);
    } else {
      return this.next ? this.next.handle(emission, stream) : Promise.resolve(emission);
    }
  }
}

export function filter(predicate: (value: any) => boolean) {
  return new FilterOperator(predicate);
}

