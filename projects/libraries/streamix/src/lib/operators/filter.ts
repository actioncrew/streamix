import { createOperator, Operator } from '../abstractions';

export const filter = <T = any>(
  predicateOrValue: ((value: any) => boolean) | T | T[]
): Operator => {
  const handle = (value: any): any => {
    const phantom =
      predicateOrValue instanceof Function
        ? !predicateOrValue(value)
        : Array.isArray(predicateOrValue)
        ? !predicateOrValue.includes(value)
        : value !== predicateOrValue;

    if (phantom) return undefined;
    else return value;
  };

  return createOperator('filter', handle);
};
