import { createOperator, Operator } from '../abstractions';

export const skip = (count: number): Operator => {
  let counter = count;

  const handle = (value: any): any => {
    if (counter <= 0) {
      return value;
    } else {
      counter--;
      return undefined;
    }
  };

  return createOperator('skip', handle);
};
