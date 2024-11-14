import { createSubject, Subject } from './subject';
import { Subscription } from '../abstractions';

// Create function for the BehaviorSubject
export function createBehaviorSubject<T = any>(initialValue: T): Subject<T> {
  const subject = createSubject<T>() as Subject<T>;

  subject.next(initialValue);

  subject.name = "behaviorSubject";
  return subject;
}
