import { Emission, Subscribable, createOperator, Operator, createEmission, eventBus, Stream } from '../abstractions';

export const delay = (delayTime: number): Operator => {
  const activeTimeouts = new Map<Emission, any>(); // Track timeouts per emission

  const init = (stream: Stream): void => {
    // Ensure timeouts are cleared on stream completion
    stream.onComplete.once(() => {
      if(stream.isStopRequested) {
        activeTimeouts.forEach((timeout, emission) => {
          clearTimeout(timeout);
          emission.finalize(); // Finalize any remaining emissions
        });
        activeTimeouts.clear(); // Clean up
      }
    });
  };

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
      activeTimeouts.delete(emission);
    }, delayTime);

    // Track the timeout for this emission
    activeTimeouts.set(emission, timeout);

    // Return the pending emission immediately
    return emission;
  };

  const operator = createOperator(handle);
  operator.init = init;
  operator.name = 'delay';

  return operator;
};
