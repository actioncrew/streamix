import { createEmission, createOperator, Operator, Subscribable } from '../abstractions';
import { Emission } from '../abstractions';
import { eventBus } from '../abstractions';

export const debounce = (time: number): Operator => {
  let timeoutId: any;
  
  const handle = function (this: Operator, emission: Emission, source: Subscribable): Emission {
    clearTimeout(timeoutId); // Clear any previous debounce timer
    timeoutId = setTimeout(() => {
      const debounced = createEmission({ value: emission.value });
      eventBus.enqueue({
        target: source,
        payload: { emission: debounced, source: this },
        type: 'emission',
      }); // Emit the debounced value
    }, time);
    emission.phantom = true; // Mark as delayed
    return emission;
  };

  const operator = createOperator(handle);
  operator.name = 'debounce';
  return operator;
};
