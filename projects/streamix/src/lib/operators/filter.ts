import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';


export class FilterOperator extends AbstractOperator {
  private readonly predicate: (value: any) => boolean;

  constructor(predicate: (value: any) => boolean) {
    super();
    this.predicate = predicate;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    try {
      emission.isPhantom = !this.predicate(emission.value);
      return emission;
    } catch (error) {
      emission.isFailed = true;
      emission.error = error;
      return emission;
    }
  }
}

export function filter(predicate: (value: any) => boolean) {
  return new FilterOperator(predicate);
}

