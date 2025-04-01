import { createOperator, Operator } from '../abstractions';

export const distinctUntilChanged = <T = any>(comparator?: (previous: T, current: T) => boolean): Operator => {
  let lastEmittedValue: T | undefined = undefined;

  const handle = (value: any): any => {
    const currentValue = value;

    const isDistinct = lastEmittedValue === undefined ||
      (comparator ? !comparator(lastEmittedValue, currentValue) : lastEmittedValue !== currentValue);

    if (isDistinct) {
      lastEmittedValue = currentValue;
      return currentValue;
    } else {
      return undefined;
    }
  };

  return createOperator('distinctUntilChanged', handle);
};
