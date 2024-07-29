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
    try {
      request.isPhantom = !this.predicate(request.value);
      return request;
    } catch (error) {
      request.isFailed = true;
      request.error = error;
      return request;
    }
  }
}

export function filter(predicate: (value: any) => boolean) {
  return new FilterOperator(predicate);
}

