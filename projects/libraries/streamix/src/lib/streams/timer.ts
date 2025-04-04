import { createSubscription, Receiver, Stream, Subscription } from '../abstractions';
import { createSubject } from './subject';

export function timer(delayMs: number = 0, intervalMs?: number): Stream<number> {
  let timerValue = 0;
  const actualIntervalMs = intervalMs ?? delayMs;

  // Create an AbortController to manage cancellation
  const abortController = new AbortController();
  const { signal } = abortController;

  const subject = createSubject<number>();

  (async () => {
    // Initial delay if specified
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } else {
      await Promise.resolve();
    }

    if (!signal.aborted) {
      // Emit the first value immediately
      subject.next(timerValue++);
    }

    // Emit subsequent values at intervals
    while (!signal.aborted) {
      await new Promise(resolve => setTimeout(resolve, actualIntervalMs));

      if (!signal.aborted) {
        subject.next(timerValue++);
      }
    }
  })();

  const originalSubscribe = subject.subscribe;
  subject.subscribe = (callbackOrReceiver?: ((value: number) => void) | Receiver<number>): Subscription => {
    const subscription = originalSubscribe.call(subject, callbackOrReceiver);

    return createSubscription(() => {
      abortController.abort();
      subscription.unsubscribe();
    });
  };
  return subject;
};
