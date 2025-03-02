import { createOperator, Emission, Operator } from '../abstractions';

export const throwError = (message: string): Operator => {
  return createOperator('throwError', () => throw new Error(message));
};
