import { Emission, Subscribable, createOperator, Operator, createEmission, eventBus, Stream, flags, hooks } from '../abstractions';

export const delay = (delayTime: number): Operator => {
  let queue = Promise.resolve();

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    // Mark the emission as pending
    emission.pending = true;

    // Schedule the delayed emission
    const delayedEmission = createEmission({ value: emission.value });
    emission.link(delayedEmission);

    queue = queue.then(
      () =>
        new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            // Check if the stream is still active before emitting
            if (stream[flags].isStopRequested || stream[flags].isStopped) {
              delayedEmission.phantom = true;
            } else {
              // Emit the delayed value
              eventBus.enqueue({
                target: stream,
                payload: { emission: delayedEmission, source: operator },
                type: 'emission',
              });
            }

            // Finalize the original emission
            emission.finalize();
            resolve();
          }, delayTime);

          // Clear timeout if the stream is stopped
          stream[hooks].onStop.once(() => {
            clearTimeout(timer);
            resolve();
          });
        })
    );

    // Return the pending emission immediately
    return emission;
  };

  const operator = createOperator(handle);
  operator.name = 'delay';

  return operator;
};
