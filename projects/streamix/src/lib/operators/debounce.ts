import { createEmission, createOperator, Emission, eventBus, Operator, Subscribable } from '../abstractions';

export const debounce = (time: number): Operator => {
  let timeoutId: any;

  const handle = (emission: Emission, source: Subscribable): Emission => {
    clearTimeout(timeoutId); // Clear any previous debounce timer
    timeoutId = setTimeout(() => {
      eventBus.enqueue({
        target: source,
        payload: { emission: createEmission({ value: emission.value }), source },
        type: 'emission',
      }); // Emit the debounced value
    }, time);
    emission.phantom = true; // Mark as delayed
    return emission;
  };

  return createOperator('debounce', handle);
};
