import { createOperator, Emission, Operator } from '../abstractions';

export const distinctUntilChanged = <T>(comparator?: (previous: T, current: T) => boolean): Operator => {
  let lastEmittedValue: T | undefined = undefined;

  const handle = (emission: Emission): Emission => {
    const currentValue = emission.value;

    const isDistinct = lastEmittedValue === undefined ||
      (comparator ? !comparator(lastEmittedValue, currentValue) : lastEmittedValue !== currentValue);

    if (isDistinct) {
      lastEmittedValue = currentValue;
      return emission;
    } else {
      emission.phantom = true;
      return emission;
    }
  };

  return createOperator('distinctUntilChanged', handle);
};
