import { createSubscription, Receiver, Stream } from "../abstractions";
import { createSubject, Subject } from "../streams";

export function merge<T = any>(...sources: Stream<T>[]): Subject<T> {
  const subject = createSubject<T>();

  const originalSubscribe = subject.subscribe;
  subject.subscribe = (callback?: ((value: T) => void) | Receiver<T>) => {
    const subscription = originalSubscribe.call(subject, callback);

    let completedCount = 0;

    // Subscribe to each source stream
    const subscriptions = sources.map((source) =>
      source.subscribe({
        next: (value) => {
          subject.next(value); // Emit value directly to the subject
        },
        complete: () => {
          completedCount++;
          if (completedCount === sources.length) {
            subject.complete(); // Complete when all sources have completed
          }
        },
        error: (err) => {
          subject.error(err); // Propagate error to the subject
        },
      })
    );

    return createSubscription(subscription, () => {
      subscription.unsubscribe();
      subscriptions.forEach((sub) => sub.unsubscribe()); // Cleanup all subscriptions
    });
  };

  subject.name = 'merge';
  return subject;
}
