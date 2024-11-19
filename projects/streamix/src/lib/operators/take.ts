import { createOperator, Operator, Stream, Subscribable } from '../abstractions';
import { Emission } from '../abstractions';

export const take = <T>(count: number): Operator => {
  let emittedCount = 0;

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    if (emittedCount < count) {
      emittedCount++;

      if(emittedCount === count) {
        stream.isAutoComplete = true;
      }
      return emission;
    } else {
      emission.phantom = true; // Mark as phantom if beyond count
      return emission;
    }
  };

  const operator = createOperator(handle);
  operator.name = 'take';
  return operator;
};
