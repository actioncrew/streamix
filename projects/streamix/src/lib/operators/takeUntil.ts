import { Chunk, createOperator, Stream, Subscription } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Subscribable } from '../abstractions/subscribable';

export const takeUntil = (notifier: Subscribable) => {
  let stopRequested = false;
  let subscription: Subscription | null = null;

  const init = (stream: Chunk) => {
    stopRequested = false;

    subscription = notifier.subscribe(() => {
      stopRequested = true;
      subscription?.unsubscribe(); // Unsubscribe from the notifier when triggered
    });
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    if (stopRequested) {
      stream.complete();
      emission.isPhantom = true; // Mark emission as phantom
      return emission;
    }
    return emission; // Return the emission if not stopped
  };

  const operator = createOperator(handle);
  operator.name = 'take';
  operator.init = init;
  return operator;
};
