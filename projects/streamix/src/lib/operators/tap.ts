import { createOperator, Operator } from '../abstractions';
import { Emission } from '../abstractions';

export const tap = (tapFunction: (value: any) => void): Operator => {
  const handle = (emission: Emission): Emission => {
    tapFunction(emission.value); // Call the tap function with the emission value
    return emission; // Return the original emission
  };

  // Create the operator with the handle function
  const operator = createOperator(handle);
  operator.name = 'tap';
  return operator;
};
