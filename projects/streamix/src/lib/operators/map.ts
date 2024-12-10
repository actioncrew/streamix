import { Subscribable } from '../abstractions';
import { Emission } from '../abstractions';
import { createOperator, Operator } from '../abstractions';

export const map = (transform: (value: any, index?: number) => any): Operator => {
  let index = 0;
  const handle = (emission: Emission): Emission => {
    emission.value = transform(emission.value, index++); // Transform the emission value
    return emission; // Return the modified emission
  };

  const operator = createOperator(handle); // Create the operator using createOperator
  operator.name = 'map';
  return operator; // Return the created operator
};
