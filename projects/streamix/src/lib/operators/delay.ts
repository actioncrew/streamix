import { Emission, Subscribable, createOperator, Operator, createEmission, eventBus, Stream } from '../abstractions';

export const delay = (delayTime: number): Operator => {
  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    // Mark the emission as pending
    emission.pending = true;

    // Schedule the delayed emission
    const delayedEmission = createEmission({ value: emission.value });

    const timeout = setTimeout(() => {
      // Link and emit the delayed emission
      emission.link(delayedEmission);
      eventBus.enqueue({
        target: stream,
        payload: { emission: delayedEmission, source: operator },
        type: 'emission',
      });

      // Finalize the original emission
      emission.finalize();

      // Remove timeout from the tracking map
      clearTimeout(timeout);
    }, delayTime);

    // Return the pending emission immediately
    return emission;
  };

  const operator = createOperator(handle);
  operator.name = 'delay';

  return operator;
};
