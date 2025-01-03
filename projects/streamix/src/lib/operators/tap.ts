import { createOperator, Emission, Operator } from '../abstractions';

export const tap = (tapFunction: (value: any) => void): Operator => {
  const handle = (emission: Emission): Emission => {
    tapFunction(emission.value); // Call the tap function with the emission value
    return emission; // Return the original emission
  };

  return createOperator('tap', handle);
};
