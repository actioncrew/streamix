import { createOperator, Operator } from '../abstractions';

export const filter = <T = any>(
  predicateOrValue: ((value: any, index?: number) => boolean) | T | T[]
): Operator => {
  let index = 0;
  const handle = (value: any): any => {
    const phantom =
      predicateOrValue instanceof Function
        ? !predicateOrValue(value, index++)
        : Array.isArray(predicateOrValue)
        ? !predicateOrValue.includes(value)
        : value !== predicateOrValue;

    if (phantom) return undefined;
    else return value;
  };

  return createOperator('filter', handle);
};
