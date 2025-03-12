import { Operator, createOperator } from '../abstractions';

export const scan = (accumulator: (acc: any, value: any, index?: number) => any, seed: any): Operator => {
  let accumulatedValue = seed; // Initialize the accumulated value
  let index = 0; // Initialize the index

  const handle = (value: any): any => {
    accumulatedValue = accumulator(accumulatedValue, value, index++); // Update the accumulated value
    return accumulatedValue;
  };

  // Create the operator with the handle function
  return createOperator('scan', handle);
};
