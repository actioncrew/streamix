import { createOperator, Operator, Stream } from '../abstractions';
import { Emission } from '../abstractions';

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

  const init = (stream: Stream) => {
    counter = count;
  };

  const operator = createOperator(handle);
  operator.name = 'skip';
  operator.init = init;
  return operator;
};
