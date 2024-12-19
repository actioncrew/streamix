
import { createSubject, Subject } from './subject';
import { Receiver, Subscription } from '../abstractions';

// Create function for the BehaviorSubject
export function createBehaviorSubject<T = any>(initialValue: T): Subject<T> {
  const subject = createSubject<T>() as Subject<T>;

  const originalSubscribe = subject.subscribe.bind(subject);

  subject.subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const subscription = originalSubscribe(callbackOrReceiver);

    subject.next(initialValue);
    return subscription;
  };

  subject.name = "behaviorSubject";
  return subject;
}
