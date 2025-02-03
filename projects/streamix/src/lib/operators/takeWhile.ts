import { createOperator, Operator, Subscribable } from '../abstractions';
import { Emission } from '../abstractions';

export const takeWhile = (predicate: (value: any, index?: number) => boolean): Operator => {
  let index = 0; // To track the index of emissions

  const handle = (emission: Emission, stream: Subscribable): Emission => {
    const shouldContinue = predicate(emission.value, index++);

    if (!shouldContinue) {
      emission.phantom = true; // Mark emission as phantom
      stream.complete(); // Complete the stream if the condition fails
      return emission;
    }

    return emission; // Return the emission if the condition is met
  };

  const operator = createOperator(handle);
  operator.name = 'takeWhile';
  return operator;
};
