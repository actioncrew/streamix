
import { Receiver, Subscription } from '../abstractions';
import { createSubject, Subject } from './subject';

// Create function for the BehaviorSubject
export function createBehaviorSubject<T = any>(initialValue: T): Subject<T> {
  const subject = createSubject<T>() as Subject<T>;

  const originalSubscribe = subject.subscribe.bind(subject);

  subject.subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const subscription = originalSubscribe(callbackOrReceiver);

    const value = subject.value ?? initialValue;
    subject.next(value);
    return subscription;
  };

  subject.name = 'behaviorSubject';
  return subject;
}
