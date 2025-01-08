import { createOperator, Emission, flags, Operator, Stream } from '../abstractions';

export const take = (count: number): Operator => {
  let emittedCount = 0;

  const handle = (emission: Emission, stream: Stream): Emission => {
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

  return createOperator('take', handle);
};
