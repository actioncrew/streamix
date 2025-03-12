import { createOperator, Operator } from '../abstractions';

export const tap = (tapFunction: (value: any) => void): Operator => {
  const handle = (value: any): any => {
    tapFunction(value); // Call the tap function with the emission value
    return value; // Return the original emission
  };

  return createOperator('tap', handle);
};
