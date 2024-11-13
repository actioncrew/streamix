import { createOperator, Operator, Subscribable } from '../abstractions';
import { Emission } from '../abstractions';

export const takeWhile = (predicate: (value: any, index?: number) => boolean) => {
  let index = 0; // To track the index of emissions

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    const shouldContinue = predicate(emission.value, index++);

    if (!shouldContinue) {
      emission.isPhantom = true; // Mark emission as phantom
      stream.complete(); // Complete the stream if the condition fails
      return emission;
    }

    return emission; // Return the emission if the condition is met
  };

  const operator = createOperator(handle) as Operator;
  operator.name = 'takeWhile';
  return operator;
};
