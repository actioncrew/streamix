import { createEmission, createOperator, Emission, eventBus, Operator, Stream } from '../abstractions';

export const debounce = (time: number): Operator => {
  let timeoutId: any;

  const handle = function (this: Operator, emission: Emission, source: Stream): Emission {
    clearTimeout(timeoutId); // Clear any previous debounce timer
    const debounced = createEmission({ value: emission.value });

    timeoutId = setTimeout(() => {
      emission.link(debounced);
      eventBus.enqueue({
        target: source,
        payload: { emission: debounced, source: this },
        type: 'emission',
      }); // Emit the debounced value
      emission.finalize();
    }, time);
    emission.pending = true; // Mark as delayed
    return emission;
  };

  return createOperator('debounce', handle);
};
