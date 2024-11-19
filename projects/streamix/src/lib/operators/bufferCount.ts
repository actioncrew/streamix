import { Stream, Subscribable, Emission } from '../abstractions';
import { Operator, createOperator } from '../abstractions';

export const bufferCount = (bufferSize: number): Operator => {
  let buffer: any[] = [];

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
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

  const operator = createOperator(handle); // Create the operator using createOperator
  operator.name = 'bufferCount';
  return operator;
};
