import { Receiver, Subscription } from '../abstractions';
import { createSubject, Subject } from './subject';

export type BehaviorSubject<T = any> = Subject<T>;

// Create function for the BehaviorSubject
export function createBehaviorSubject<T = any>(initialValue: T): BehaviorSubject<T> {
  const subject = createSubject<T>() as Subject<T>;

  const originalSubscribe = subject.subscribe.bind(subject);

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const subscription = originalSubscribe(callbackOrReceiver);

    subject.next(initialValue);
    return subscription;
  };

  Object.assign(subject, {
    name: 'behaviorSubject',
    subscribe
  });

  return subject as BehaviorSubject<T>;
}
