import { Emission, Operator, createOperator } from '../abstractions';

export const catchError = (handler: (error?: any) => void | Promise<void>): Operator => {
  const handle = (emission: Emission): Emission => {
    handler(emission.error);
    delete emission.error;
    return emission;
  };

  return createOperator('catchError', handle);
};
