import { createOperator, Operator } from '../abstractions';
import { Emission } from '../abstractions';
import { Subscribable } from '../abstractions';

export const distinctUntilChanged = <T>(comparator?: (previous: T, current: T) => boolean) => {
  let lastEmittedValue: T | undefined = undefined;

  const init = () => {
    lastEmittedValue = undefined;
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<any> => {
    const currentValue = emission.value;

    const isDistinct = lastEmittedValue === undefined ||
      (comparator ? !comparator(lastEmittedValue, currentValue) : lastEmittedValue !== currentValue);

    if (isDistinct) {
      lastEmittedValue = currentValue;
      return emission;
    } else {
      emission.isPhantom = true;
      return emission;
    }
  };

  const operator = createOperator(handle) as Operator;
  operator.name = 'distinctUntilChanged';
  operator.init = init;
  return operator;
};
