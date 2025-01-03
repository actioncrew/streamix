import { createOperator, Emission, Operator } from '../abstractions';

export const filter = <T = any>(
  predicateOrValue: ((value: any) => boolean) | T | T[]
): Operator => {
  const handle = (emission: Emission): Emission => {
    const phantom =
      predicateOrValue instanceof Function
        ? !predicateOrValue(emission.value)
        : Array.isArray(predicateOrValue)
        ? !predicateOrValue.includes(emission.value)
        : emission.value !== predicateOrValue;

    if (phantom) emission.phantom = true;
    else delete emission.phantom;
    return emission;
  };

  return createOperator('filter', handle);
};
