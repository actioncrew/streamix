import { createReceiver, createSubscription, Operator, Receiver, Stream, StreamOperator, Subscription } from "../abstractions";
import { Subject } from "./subject";

export type BehaviorSubject<T = any> = Subject<T>;

// BehaviorSubject Stream Implementation
export function createBehaviorSubject<T = any>(initialValue: T): BehaviorSubject<T> {
  let subscribers: Receiver<T>[] = [];
  let currentValue: T = initialValue;  // Initialize with the provided value
  let completed = false; // Flag to indicate if the stream is completed
  let hasError = false; // Flag to indicate if an error has occurred
  let errorValue: any = null; // Store the error value
  let emissionCounter = 0;

  // Emit a new value to all subscribers
  const next = (value: T) => {
    if (completed || hasError) return; // Prevent emitting if the stream is completed or in error state
    emissionCounter++;
    currentValue = value;
    subscribers.forEach((subscriber) => subscriber.next?.(value));
    subscribers = subscribers.filter((subscriber) => !subscriber.unsubscribed);
  };

  // Complete the stream
  const complete = () => {
    if (completed) return; // If already completed or in error state, do nothing
    completed = true;
    subscribers.forEach((subscriber) => subscriber.complete?.());
    subscribers = subscribers.filter((subscriber) => !subscriber.unsubscribed); // Clean up
  };

  // Emit an error to all subscribers
  const error = (err: any) => {
    if (completed || hasError) return; // Prevent emitting errors if the stream is completed or in error state
    hasError = true;
    errorValue = err;
    subscribers.forEach((subscriber) => subscriber.error?.(err));
    subscribers = subscribers.filter((subscriber) => !subscriber.unsubscribed); // Clean up
  };

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    subscribers.push(receiver);

    // Emit the current value to the new subscriber immediately
    if (!hasError) {
      receiver.next?.(currentValue);
    }

    if (hasError) {
      receiver.error?.(errorValue); // If the stream has errored, emit the error immediately
    }

    if (completed) {
      receiver.complete?.(); // If completed, notify the subscriber
    }

    return createSubscription(() => currentValue, () => {
      if (!receiver.unsubscribed) {
        receiver.unsubscribed = true;
        if (!completed && !hasError) {
          receiver.complete?.();
        }
        subscribers = subscribers.filter((sub) => sub !== receiver); // Clean up
      }
    });
  };

  const stream: BehaviorSubject<T> = {
    type: "subject",
    name: "behaviorSubject",
    emissionCounter,
    subscribe,
    pipe: function (...steps: (Operator | StreamOperator)[]): Stream {
      return this.pipe(...steps); // Ensuring pipe correctly applies to the current stream
    },
    value: () => currentValue,
    next, // Add next method
    complete, // Add complete
    completed: () => completed,
    error, // Add error method
  };

  return stream;
}
