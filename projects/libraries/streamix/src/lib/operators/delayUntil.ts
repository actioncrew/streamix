import { createMapper, createReceiver, createSubscription, Stream, StreamMapper, Subscription } from "../abstractions";
import { createSubject } from "../streams";

export function delayUntil<T = any>(notifier: Stream<any>): StreamMapper {
  const operator = (input: Stream<T>, output: Subject<T>) => {
    const output = createSubject<T>();
    let inputSubscription: Subscription | null = null;
    let notifierSubscription: Subscription | null = null;
    let hasNotified = false;
    let pendingValues: T[] = [];

    notifierSubscription = notifier.subscribe({
      next: () => {
        if (!hasNotified) {
          hasNotified = true;
          pendingValues.forEach((value) => output.next(value));
          pendingValues = [];
        }
      },
      error: (err) => {
        output.error(err);
      },
      complete: () => {
        if (inputSubscription) {
          inputSubscription.unsubscribe();
          inputSubscription = null;
        }
        if (!hasNotified) {
          output.complete();
        }
      },
    });

    inputSubscription = input.subscribe({
      next: (value) => {
        if (hasNotified) {
          output.next(value);
        } else {
          pendingValues.push(value);
        }
      },
      error: (err) => {
        output.error(err);
      },
      complete: () => {
        if (hasNotified) {
          output.complete();
        }
      },
    });

    const originalSubscribe = output.subscribe;
    output.subscribe = (callbackOrReceiver) => {
      const receiver = createReceiver(callbackOrReceiver);
      const subscription = originalSubscribe.call(output, receiver);
      return createSubscription(() => {
        subscription.unsubscribe();
        if (inputSubscription) {
          inputSubscription.unsubscribe();
          inputSubscription = null;
        }
        if (notifierSubscription) {
          notifierSubscription.unsubscribe();
          notifierSubscription = null;
        }
        receiver.complete();
      });
    };

    return output;
  };

  return createMapper('delayUntil', operator);
}
