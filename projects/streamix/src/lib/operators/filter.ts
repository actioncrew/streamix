import { createOperator, Operator, Subscribable } from '../abstractions';
import { Emission } from '../abstractions';

export const filter = (predicate: (value: any) => boolean): Operator => {
  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    emission.phantom = !predicate(emission.value);
    return emission;
  };

  const operator = createOperator(handle);
  operator.name = 'filter';
  return operator;
};
