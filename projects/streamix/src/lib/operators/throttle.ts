import { createOperator, Operator } from '../abstractions';
import { Emission } from '../abstractions';

export const throttle = (time: number): Operator => {
  let lastEmissionTime = 0;

  const handle = (emission: Emission): Emission => {
    const now = Date.now();
    if (now - lastEmissionTime >= time) {
      lastEmissionTime = now;
      return emission; // Pass through the emission
    } else {
      emission.phantom = true; // Mark emission as ignored
      return emission;
    }
  };

  const operator = createOperator(handle);
  operator.name = 'throttle';
  return operator;
};
