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

  const init = () => {
    counter = count;
  };

  const operator = createOperator(handle);
  operator.name = 'skip';
  operator.init = init;
  return operator;
};
