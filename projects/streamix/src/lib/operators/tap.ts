import { createOperator, Operator, Subscribable } from '../abstractions';
import { Emission } from '../abstractions';

export const tap = (tapFunction: (value: any) => void) => {
  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    tapFunction(emission.value); // Call the tap function with the emission value
    return emission; // Return the original emission
  };

  // Create the operator with the handle function
  const operator = createOperator(handle) as Operator;
  operator.name = 'tap';
  return operator;
};
