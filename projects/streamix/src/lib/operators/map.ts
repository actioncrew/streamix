import { createOperator, Emission, Operator } from '../abstractions';

export const map = (transform: (value: any, index: number) => any): Operator => {
  let index = 0;
  const handle = (emission: Emission): Emission => {
    emission.value = transform(emission.value, index++); // Transform the emission value
    return emission; // Return the modified emission
  };

  return createOperator('map', handle);
};
