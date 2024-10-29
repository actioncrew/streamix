import { Chunk, Stream, Subscribable, createOperator } from '../abstractions';
import { Emission } from '../abstractions/emission';

export const scan = (accumulator: (acc: any, value: any, index?: number) => any, seed: any) => {
  let accumulatedValue = seed; // Initialize the accumulated value
  let index = 0; // Initialize the index

  const init = (stream: Chunk) => {
    accumulatedValue = seed; // Reset accumulated value on initialization
    index = 0; // Reset index on initialization
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    accumulatedValue = accumulator(accumulatedValue, emission.value!, index++); // Update the accumulated value
    emission.value = accumulatedValue; // Set the updated value to the emission
    return emission; // Return the modified emission
  };

  // Create the operator with the handle function
  const operator = createOperator(handle);
  operator.name = 'scan';
  operator.init = init;
  return operator; // Return the operator
};
