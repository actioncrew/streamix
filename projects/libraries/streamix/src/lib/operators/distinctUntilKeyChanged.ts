import { createOperator, Operator } from '../abstractions';

export const distinctUntilKeyChanged = <T extends object>(
  key: keyof T,
  comparator?: (previous: T[keyof T], current: T[keyof T]) => boolean
): Operator => {
  let lastEmittedValue: T | undefined = undefined;

  const handle = (value: T): T | undefined => {
    const currentValue = value;

    const isDistinct = lastEmittedValue === undefined ||
      (comparator
        ? !comparator(lastEmittedValue[key], currentValue[key])
        : lastEmittedValue[key] !== currentValue[key]);

    if (isDistinct) {
      lastEmittedValue = currentValue;
      return currentValue;
    } else {
      return undefined;
    }
  };

  return createOperator('distinctUntilKeyChanged', handle);
};
