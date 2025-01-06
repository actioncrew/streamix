import { Emission, Operator, Subscribable, createEmission, createOperator, eventBus, flags } from '../abstractions';

export const delay = (delayTime: number): Operator => {
  let queue = new Promise<void>((resolve) => {
    setTimeout(() => resolve(), 0); // No-op for the first promise
  });

  const registry = new Map<Emission, { timer: any; resolve: () => void }>();

  const finalize = () => {
    for (const [emission, { timer, resolve }] of registry.entries()) {
      if (!emission.complete) {
        emission.reject(new Error('Emission was not resolved before stream finalized.'));
      }

      emission.finalize();
      clearTimeout(timer);
      resolve();
    }
    registry.clear();
  };

  const init = (stream: Subscribable) => {
    stream.emitter.once('complete', finalize);
  }

  const handle = function (this: Operator, emission: Emission, stream: Subscribable): Emission {
    // Mark the emission as pending
    emission.pending = true;

    // Create a new emission that will be processed after the delay
    const delayedEmission = createEmission({ value: emission.value });
    emission.link(delayedEmission);

    // Chain the emission processing in the queue
    queue = queue.then(() => {
      return new Promise<void>((resolve) => {
        // Schedule the delayed emission
        const timer = setTimeout(() => {
          if (stream[flags].isUnsubscribed) {
            delayedEmission.phantom = true;
          } else {
            eventBus.enqueue({
              target: stream,
              payload: { emission: delayedEmission, source: this },
              type: 'emission',
            });
          }

          // Finalize the current emission
          emission.finalize();
          registry.delete(emission);
          resolve();
        }, delayTime);

        // Register the timer and resolve function
        registry.set(emission, { timer, resolve });
      });
    });

    // Return the original emission to indicate it is pending
    return emission;
  };

  const operator = createOperator(handle);
  operator.init = init;
  operator.name = 'delay';

  return operator;
};
