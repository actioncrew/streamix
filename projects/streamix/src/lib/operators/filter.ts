import { Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';


export class FilterOperator extends Operator {
  constructor(private readonly predicate: (value: any) => boolean) {
    super();
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    emission.isPhantom = !this.predicate(emission.value);
    return emission;
  }
}

export const filter = (predicate: (value: any) => boolean) => new FilterOperator(predicate);


