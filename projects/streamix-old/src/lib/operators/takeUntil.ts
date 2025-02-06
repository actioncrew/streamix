import { createStreamOperator, Stream, StreamOperator, Subscription } from '../abstractions';
import { createSubject } from '../streams';

export const takeUntil = (notifier: Stream): StreamOperator => {
  const operator = (input: Stream) => {
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
    notifierSubscription = notifier({
      next: () => {
        // Trigger stream completion when the notifier emits
        finalize();
      },
      complete: finalize, // Clean up when the notifier completes
    });

    // Subscribe to the source stream
    sourceSubscription = input({
      next: (value) => {
        // Forward values to the output stream
        output.next(value);
      },
      complete: finalize, // Complete the output stream when the source completes
    });

    // Clean up subscriptions when the output stream finalizes
    output.emitter.once('finalize', () => {
      finalize();
    });

    return output;
  };

  return createStreamOperator('takeUntil', operator);
};
