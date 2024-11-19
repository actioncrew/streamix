import { createOperator, Operator, Stream, Subscription } from '../abstractions';
import { Emission } from '../abstractions';
import { Subscribable } from '../abstractions';

export const takeUntil = (notifier: Subscribable): Operator => {
  let stopRequested = false;
  let subscription: Subscription | null = null;

  const init = (stream: Stream) => {
    // Override the run method to manage subscription to the notifier
    const originalRun = stream.run;

    stream.run = async () => {
      stopRequested = false;

      // Subscribe to the notifier and set stopRequested on emission
      subscription = notifier.subscribe((value) => {
        stopRequested = true;
        subscription?.unsubscribe(); // Unsubscribe from the notifier on first emission
      });

      // Ensure the notifier has started
      await subscription.started;

      // Start the main stream after the notifier has been confirmed to run
      await originalRun.call(stream);
    };

    // Clean up the notifier subscription on stream stop
    stream.onStop.once(async () => {
      await subscription?.unsubscribe();
      subscription = null;
    });
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    if (stopRequested) {
      stream.isAutoComplete = true;
      emission.phantom = true; // Mark emission as phantom to indicate it's ignored
      return emission;
    }
    return emission; // Pass through emission if not stopped
  };

  const operator = createOperator(handle);
  operator.name = 'takeUntil';
  operator.init = init;
  return operator;
};
