import { createOperator, Emission, Operator } from '../abstractions';

export const skip = (count: number): Operator => {
  let counter = count;

  const handle = (emission: Emission): Emission => {
    if (counter <= 0) {
      return emission;
    } else {
      counter--;
      emission.phantom = true;
      return emission;
    }
  };

  return createOperator('skip', handle);
};
