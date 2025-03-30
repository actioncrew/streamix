import { Operator, createOperator } from '../abstractions';

export const first = (predicate?: (value: any) => boolean): Operator => {
  let found = false;

  const handle = (value: any): any => {
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
