import { Operator, createOperator } from '../abstractions';

export const first = <T = any>(predicate?: (value: T) => boolean): Operator => {
  let found = false;

  const handle = (value: T): any => {
    // If we already found the first value, skip subsequent values
    if (found) return undefined;
    
    // Check predicate if provided
    if (!predicate || predicate(value)) {
      found = true;
      return value;
    }
    
    // Value doesn't match predicate
    return undefined;
  };

  return createOperator('first', handle);
};
