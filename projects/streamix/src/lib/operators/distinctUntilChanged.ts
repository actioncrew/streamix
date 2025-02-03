import { createOperator, Operator } from '../abstractions';
import { Emission } from '../abstractions';

export const distinctUntilChanged = <T>(comparator?: (previous: T, current: T) => boolean): Operator => {
  let lastEmittedValue: T | undefined = undefined;

  const init = () => {
    lastEmittedValue = undefined;
  };

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

  const operator = createOperator(handle);
  operator.name = 'distinctUntilChanged';
  operator.init = init;
  return operator;
};
