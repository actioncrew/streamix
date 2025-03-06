import { createReceiver, Receiver, Subscription } from '../abstractions';
import { createSubject, Subject } from '../streams';

export type BehaviorSubject<T = any> = Subject<T> & {
  readonly value: T; // Expose the current value
};

// Create function for the BehaviorSubject
export function createBehaviorSubject<T = any>(initialValue: T): BehaviorSubject<T> {
  let currentValue = initialValue; // Store the current value
  const subject = createSubject<T>() as Subject<T>;

  // Override the `next` method to update the current value
  const originalNext = subject.next;
  subject.next = (value: T) => {
    currentValue = value; // Update the current value
    originalNext.call(subject, value); // Emit the value to all subscribers
  };

  // Override the `subscribe` method to emit the current value to new subscribers
  const originalSubscribe = subject.subscribe;
  subject.subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    const subscription = originalSubscribe.call(subject, receiver);

    // Emit the current value to the new subscriber immediately
    receiver.next?.(currentValue);

    return subscription;
  };

  // Create the BehaviorSubject
  Object.defineProperty(subject, 'value', {
    get: () => currentValue,
    configurable: false,
    enumerable: false,
  });

  subject.name = 'behaviorSubject';
  return subject as BehaviorSubject<T>;
}
