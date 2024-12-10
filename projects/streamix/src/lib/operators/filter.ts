import { createOperator, Operator, Subscribable } from '../abstractions';
import { Emission } from '../abstractions';

export const filter = <T = any>(
  predicateOrValue: ((value: T) => boolean) | T | T[]
): Operator => {
  const handle = (emission: Emission): Emission => {
    if (predicateOrValue instanceof Function) {
      // Handle predicate function
      emission.phantom = !predicateOrValue(emission.value);
    } else if (Array.isArray(predicateOrValue)) {
      // Handle array comparison
      emission.phantom = !predicateOrValue.includes(emission.value);
    } else {
      // Handle single value comparison
      emission.phantom = emission.value !== predicateOrValue;
    }
    return emission;
  };

  const operator = createOperator(handle);
  operator.name = 'filter';
  return operator;
};
