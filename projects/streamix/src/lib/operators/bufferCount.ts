import { Stream, Subscribable, Emission } from '../abstractions';
import { OperatorType, createOperator } from '../abstractions/operator';

export const bufferCount = (bufferSize: number): OperatorType => {
  let buffer: any[] = [];

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    buffer.push(emission.value);

    if (buffer.length >= bufferSize) {
      const bufferedArray = buffer;
      buffer = [];  // Clear the buffer after emitting
      return { value: bufferedArray }; // Emit the full buffer
    }

    // If buffer isn't full, return a phantom emission
    return { isPhantom: true };
  };

  const operator = createOperator(handle); // Create the operator using createOperator
  return operator;
};
