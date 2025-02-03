import { createOperator, Emission, flags, Operator, Subscribable } from '../abstractions';

export const take = (count: number): Operator => {
  let emittedCount = 0;

  const handle = (emission: Emission, stream: Subscribable): Emission => {
    if (emittedCount < count) {
      emittedCount++;

      if(emittedCount === count) {
        stream[flags].isAutoComplete = true;
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
