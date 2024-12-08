import { emitDistinctChangesOnlyDefaultValue } from '@angular/compiler';
import { Emission, Subscribable, createOperator, Operator, createEmission, eventBus, Stream, flags, hooks } from '../abstractions';

export const delay = (delayTime: number): Operator => {
  let queue = Promise.resolve();
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
    stream[hooks].onComplete.once(finalize);
  }

  const handle = function (this: Operator, emission: Emission, stream: Subscribable): Emission {
    emission.pending = true;

    const delayedEmission = createEmission({ value: emission.value });
    emission.link(delayedEmission);

    queue = queue.then(
      () =>
        new Promise<void>((resolve) => {
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

            emission.finalize();
            registry.delete(emission);
            resolve();
          }, delayTime);

          registry.set(emission, { timer, resolve });
        })
    );

    return emission;
  };

  const operator = createOperator(handle);
  operator.init = init;
  operator.name = 'delay';

  return operator;
};
