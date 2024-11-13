import { createOperator, Stream, Subscribable } from '../abstractions';
import { Emission } from '../abstractions';

export const skip = (count: number) => {
  let counter = count;

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    if (counter <= 0) {
      return emission;
    } else {
      counter--;
      emission.isPhantom = true;
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
