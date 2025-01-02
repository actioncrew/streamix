import { Emission, Operator, createOperator } from '../abstractions';

export const catchError = (handler: (error?: any) => void | Promise<void>): Operator => {
  const handle = (emission: Emission): Emission => {
    handler(emission.error);
    delete emission.failed;
    delete emission.error;
    return emission;
  };

  const operator = createOperator(handle);
  operator.name = 'catchError';
  return operator;
};
