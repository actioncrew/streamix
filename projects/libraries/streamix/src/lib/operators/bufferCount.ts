import { Emission, Operator, createOperator } from '../abstractions';

export const bufferCount = (bufferSize: number = Infinity): Operator => {
  let buffer: any[] = [];

  const handle = (emission: Emission): Emission => {
    buffer.push(emission.value);

    if (buffer.length >= bufferSize) {
      const bufferedArray = buffer;
      buffer = [];  // Clear the buffer after emitting
      emission.value = bufferedArray;
      return emission; // Emit the full buffer
    }

    // If buffer isn't full, return a phantom emission
    emission.phantom = true;
    return emission;
  };

  return createOperator('bufferCount', handle); // Create the operator using createOperator
};
