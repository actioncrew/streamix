import { createStreamOperator, Stream, StreamOperator, Subscription } from "../abstractions";
import { createSubject } from "../streams";

export function takeUntil<T>(notifier: Stream<any>): StreamOperator {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let inputSubscription: Subscription | null = null;
    let notifierSubscription: Subscription | null = null;

    // Subscribe to the input stream
    inputSubscription = input.subscribe({
      next: (value) => output.next(value),
      error: (err) => output.error(err),
      complete: () => output.complete(),
    });

    // Subscribe to the notifier stream
    notifierSubscription = notifier.subscribe({
      next: () => {
        // When the notifier emits, complete the output stream
        output.complete();
        if (inputSubscription) inputSubscription.unsubscribe();
        if (notifierSubscription) notifierSubscription.unsubscribe();
      },
      error: (err) => output.error(err),
      complete: () => {
        // If the notifier completes without emitting, do nothing
      },
    });

    return output;
  };

  return createStreamOperator('takeUntil', operator);
}
