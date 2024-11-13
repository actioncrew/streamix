import { createOperator, Operator, Subscribable } from '../abstractions';
import { Emission } from '../abstractions';

export const filter = (predicate: (value: any) => boolean) => {
  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    emission.isPhantom = !predicate(emission.value);
    return emission;
  };

  const operator = createOperator(handle) as Operator;
  operator.name = 'filter';
  return operator;
};
