import { createOperator, Operator } from '../abstractions';

export const map = (transform: (value: any, index: number) => any): Operator => {
  let index = 0;
  const handle = (value: any): any => {
    return transform(value, index++); // Transform the emission value
  };

  return createOperator('map', handle);
};
