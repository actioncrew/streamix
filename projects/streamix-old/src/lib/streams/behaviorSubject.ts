
import { Receiver, Subscription } from '../abstractions';
import { createSubject, Subject } from './subject';

// Create function for the BehaviorSubject
export function createBehaviorSubject<T = any>(initialValue: T): Subject<T> {
  const subject = createSubject<T>() as Subject<T>;

  const originalSubscribe = subject.subscribe.bind(subject);

  const behaviorSubject = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const subscription = originalSubscribe(callbackOrReceiver);

    subject.next(initialValue);
    return subscription;
  };

  Object.defineProperty(behaviorSubject, 'name', { writable: true, enumerable: true, configurable: true });
  Object.assign(behaviorSubject, subject);
  behaviorSubject.name = 'behaviorSubject';
  behaviorSubject.subscribe = behaviorSubject;
  return behaviorSubject as unknown as Subject<T>;
}
