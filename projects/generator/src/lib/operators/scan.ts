import { Emission, Operator, createOperator } from '../abstractions';

export const scan = (accumulator: (acc: any, value: any, index?: number) => any, seed: any): Operator => {
  let accumulatedValue = seed; // Initialize the accumulated value
  let index = 0; // Initialize the index

  const handle = (emission: Emission): Emission => {
    accumulatedValue = accumulator(accumulatedValue, emission.value!, index++); // Update the accumulated value
    emission.value = accumulatedValue; // Set the updated value to the emission
    return emission; // Return the modified emission
  };

  // Create the operator with the handle function
  return createOperator('scan', handle);
};
