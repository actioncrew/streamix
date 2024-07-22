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
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    try {
      emission.value = this.transform(emission.value);
      return emission;
    } catch(error) {
      emission.error = error;
      emission.isFailed = true;
      return emission;
    }
  }
}

export function map(transform: (value: any) => any) {
  return new MapOperator(transform);
}
