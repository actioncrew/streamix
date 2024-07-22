import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';

export class DistinctUntilChangedOperator<T> extends AbstractOperator {
  private lastEmittedValue: T | undefined;
  private comparator?: (previous: T, current: T) => boolean;

  constructor(comparator?: (previous: T, current: T) => boolean) {
    super();
    this.comparator = comparator;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<any> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    const currentValue = emission.value;

    if (this.lastEmittedValue === undefined ||
        (this.comparator ? !this.comparator(this.lastEmittedValue, currentValue) : this.lastEmittedValue !== currentValue)) {
      this.lastEmittedValue = currentValue;
      return emission;
    } else {
      emission.isPhantom = true;
      return emission;
    }
  }
}

export function distinctUntilChanged<T>(comparator?: (previous: T, current: T) => boolean) {
  return new DistinctUntilChangedOperator<T>(comparator);
}
