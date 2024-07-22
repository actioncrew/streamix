import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class StartWithOperator<T> extends AbstractOperator {
  private initialValue: T;
  private hasEmittedInitial: boolean = false;

  constructor(initialValue: any) {
    super();
    this.initialValue = initialValue;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    if (!this.hasEmittedInitial) {
      this.hasEmittedInitial = true;
      return { value: this.initialValue };
    }

    return emission;
  }
}

export function startWith(initialValue: any) {
  return new StartWithOperator(initialValue);
}
