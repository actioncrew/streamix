import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';
import { Subscribable } from '../abstractions/subscribable';

export class DistinctUntilChangedOperator<T> extends Operator {
  private lastEmittedValue: T | undefined;
  private comparator?: (previous: T, current: T) => boolean;

  constructor(comparator?: (previous: T, current: T) => boolean) {
    super();
    this.comparator = comparator;
  }

  async handle(emission: Emission, stream: Subscribable): Promise<any> {
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

export const distinctUntilChanged = <T>(comparator?: (previous: T, current: T) => boolean) => new DistinctUntilChangedOperator<T>(comparator);

