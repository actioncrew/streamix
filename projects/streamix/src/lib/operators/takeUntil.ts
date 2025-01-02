import { hooks, Stream, StreamOperator, Subscribable, Subscription } from '../abstractions';
import { createSubject } from '../streams';

export const takeUntil = (notifier: Subscribable): StreamOperator => {
  return (input: Stream): Stream => {
    const output = createSubject(); // The resulting stream
    let notifierSubscription: Subscription | null = null;
    let sourceSubscription: Subscription | null = null;
    let finalized = false;

    const finalize = async () => {
      if(!finalized) {
        finalized = true;
        await notifierSubscription?.unsubscribe();
        await sourceSubscription?.unsubscribe();
        output.complete();
      }
    };

    // Subscribe to the notifier
    notifierSubscription = notifier.subscribe({
      next: () => {
        // Trigger stream completion when the notifier emits
        finalize();
      },
      complete: finalize, // Clean up when the notifier completes
    });

    // Subscribe to the source stream
    sourceSubscription = input.subscribe({
      next: (value) => {
        // Forward values to the output stream
        output.next(value);
      },
      complete: finalize, // Complete the output stream when the source completes
    });

    // Clean up subscriptions when the output stream finalizes
    output[hooks].finalize.once(() => {
      finalize();
    });

    return output; // Return the new stream
  };
};
