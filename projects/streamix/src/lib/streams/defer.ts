import { createSubscription, Receiver, Stream } from "../abstractions";
import { createSubject, Subject } from "../streams/subject";

export function defer<T = any>(factory: () => Stream<T>): Subject<T> {
  const subject = createSubject<T>(); // Create a subject to hold emitted values

  // Redefine subscribe to lazily initialize the inner stream
  const originalSubscribe = subject.subscribe;
  const subscribe = (callback?: ((value: T) => void) | Receiver<T>) => {
    // Lazily create the inner stream when the subject is subscribed to
    const innerStream = factory();

    const subscription = originalSubscribe.call(subject, callback);

    // Subscribe to the inner stream and emit its values
    const innerSubscription = innerStream.subscribe({
      next: (value: T) => {
        subject.next(value); // Emit values from the inner stream to the subject
      },
      complete: () => {
        subject.complete(); // Complete the subject when the inner stream completes
        innerSubscription.unsubscribe();
      },
      error: (err: any) => {
        subject.error(err); // Propagate errors from the inner stream to the subject
        innerSubscription.unsubscribe();
      },
    });

    return createSubscription(subscription, () => {
      subscription.unsubscribe();
      innerSubscription.unsubscribe(); // Cleanup both inner and outer subscriptions
    });
  };

  subject.name = 'defer';
  subject.subscribe = subscribe;
  return subject;
}
