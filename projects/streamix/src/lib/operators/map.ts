import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class MapOperator extends AbstractOperator {
  private readonly transform: (value: any) => any;

  constructor(transform: (value: any) => any) {
    super();
    this.transform = transform;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    emission.value = this.transform(emission.value);
    return emission;
  }
}

export const map = (transform: (value: any) => any) => new MapOperator(transform);
