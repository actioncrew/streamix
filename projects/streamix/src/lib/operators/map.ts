import { Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class MapOperator extends Operator {
  constructor(private readonly transform: (value: any) => any) {
    super();
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    const value = this.transform(emission.value);
    return { value };
  }
}

export const map = (transform: (value: any) => any) => new MapOperator(transform);
