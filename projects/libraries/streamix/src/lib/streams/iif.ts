import { createSubscription, Receiver, Stream } from "../abstractions";
import { createSubject, Subject } from "../streams";

export function iif<T = any>(
  condition: () => boolean,
  trueStream: Stream<T>,
  falseStream: Stream<T>
): Subject<T> {
  const subject = createSubject<T>(); // Create a subject to emit values

  // Redefine subscribe to lazily initialize the stream based on condition
  const originalSubscribe = subject.subscribe;
  subject.subscribe = (callback?: ((value: T) => void) | Receiver<T>) => {
    // Choose the stream based on the condition
    const sourceStream = condition() ? trueStream : falseStream;

    const subscription = originalSubscribe.call(subject, callback);

    // Subscribe to the chosen stream
    const innerSubscription = sourceStream.subscribe({
      next: (value: T) => {
        subject.next(value); // Emit values from the chosen stream
      },
      complete: () => {
        subject.complete(); // Complete the subject when the inner stream completes
        innerSubscription.unsubscribe();
      },
      error: (err: any) => {
        subject.error(err); // Propagate errors to the subject
        innerSubscription.unsubscribe();
      },
    });

    return createSubscription(() => {
      subscription.unsubscribe();
      innerSubscription.unsubscribe(); // Clean up both subscriptions
    });
  };

  subject.name = 'iif';
  return subject;
}
