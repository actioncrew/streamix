import { Subscribable } from '../abstractions';
import { Emission } from '../abstractions';
import { createOperator, Operator } from '../abstractions';

export const map = (transform: (value: any) => any) => {
  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    const value = transform(emission.value); // Transform the emission value
    return { value }; // Return the modified emission
  };

  const operator = createOperator(handle); // Create the operator using createOperator
  operator.name = 'map';
  return operator; // Return the created operator
};
