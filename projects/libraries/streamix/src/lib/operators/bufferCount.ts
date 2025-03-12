import { Operator, createOperator } from '../abstractions';

export const bufferCount = (bufferSize: number = Infinity): Operator => {
  let buffer: any[] = [];

  const handle = (value: any): any => {
    buffer.push(value);

    if (buffer.length >= bufferSize) {
      const bufferedArray = buffer;
      buffer = [];  // Clear the buffer after emitting
      return bufferedArray;
    }

    // If buffer isn't full, return a phantom emission
    return undefined;
  };

  return createOperator('bufferCount', handle); // Create the operator using createOperator
};
