import { Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class MapOperator extends Operator {
  private readonly transform: (value: any) => any;

  constructor(transform: (value: any) => any) {
    super();
    this.transform = transform;
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    emission.value = this.transform(emission.value);
    return emission;
  }
}

export const map = (transform: (value: any) => any) => new MapOperator(transform);
