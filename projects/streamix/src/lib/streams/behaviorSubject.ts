import { createSubject, Subject } from './subject';
import { Subscription } from '../abstractions';

// Create function for the BehaviorSubject
export function createBehaviorSubject<T = any>(initialValue: T): Subject<T> {
  const subject = createSubject<T>() as Subject<T>;
  let latestValue = initialValue;
  let hasEmittedInitialValue = false;

  // Override the next method to update the latest value and emit it
  const originalNext = subject.next.bind(subject); // Preserve the original next method

  subject.next = async (value?: T): Promise<void> => {
    latestValue = value!;  // Update the latest value
    await originalNext(value); // Call the original next method from Subject
  };

  // Ensure the latest value is emitted when a new subscriber subscribes
  subject.subscribe = (callback?: (value: T) => void): Subscription => {
    if (callback) {
      if (!hasEmittedInitialValue) {
        callback(latestValue);
        hasEmittedInitialValue = true;
      }
    }
    return subject.subscribe(callback); // Call the original subscribe method
  };

  return subject;
}
