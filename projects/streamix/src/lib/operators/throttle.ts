import { createOperator, Emission, Operator } from '../abstractions';

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

  return createOperator('throttle', handle);
};
