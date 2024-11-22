import { Emission, Subscribable, createOperator, Operator, createEmission, eventBus, Stream } from '../abstractions';

export const delay = (delayTime: number): Operator => {
  let queue = Promise.resolve();

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    // Mark the emission as pending
    emission.pending = true;

    // Schedule the delayed emission
    const delayedEmission = createEmission({ value: emission.value });
    emission.link(delayedEmission);

    queue = queue.then(() => new Promise<void>((resolve) => setTimeout(() => {
      // Link and emit the delayed emission
      eventBus.enqueue({
        target: stream,
        payload: { emission: delayedEmission, source: operator },
        type: 'emission',
      });

      // Finalize the original emission
      emission.finalize();
      resolve();
    }, delayTime)));

    // Return the pending emission immediately
    return emission;
  };

  const operator = createOperator(handle);
  operator.name = 'delay';

  return operator;
};
