import { Stream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';


export class FilterOperator extends Operator {
  private readonly predicate: (value: any) => boolean;

  constructor(predicate: (value: any) => boolean) {
    super();
    this.predicate = predicate;
  }

  async handle(emission: Emission, stream: Stream): Promise<Emission> {
    emission.isPhantom = !this.predicate(emission.value);
    return emission;
  }
}

export const filter = (predicate: (value: any) => boolean) => new FilterOperator(predicate);


