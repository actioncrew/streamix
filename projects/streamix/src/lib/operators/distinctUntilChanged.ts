import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';

export class DistinctUntilChangedOperator<T> extends AbstractOperator {
  private lastEmittedValue: T | undefined;

  constructor() {
    super();
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<any> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    if (this.lastEmittedValue === undefined || emission.value !== this.lastEmittedValue) {
      this.lastEmittedValue = emission.value;
      return this.next?.process(emission, stream) ?? Promise.resolve(emission);
    } else {
      emission.isPhantom = true;
      return;
    }
  }
}

export function distinctUntilChanged<T>() {
  return new DistinctUntilChangedOperator<T>();
}
