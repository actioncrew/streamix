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
    emission.isPhantom = !this.predicate(emission.value);
    return emission;
  }
}

export function filter(predicate: (value: any) => boolean) {
  return new FilterOperator(predicate);
}

