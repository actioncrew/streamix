import { createSubject, Subject } from './subject';

export type BehaviorSubject<T = any> = Subject<T>;

// Create function for the BehaviorSubject
export function createBehaviorSubject<T = any>(initialValue: T): BehaviorSubject<T> {
  const subject = createSubject<T>() as Subject<T>;

  subject.next(initialValue);

  Object.assign(subject, {
    name: 'behaviorSubject'
  });

  return subject as BehaviorSubject<T>;
}
