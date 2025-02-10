import { Receiver } from "../abstractions";
import { createSubject, Subject } from "./subject";

export type BehaviorSubject<T = any> = Subject<T>;

export function createBehaviorSubject<T = any>(initialValue: T): BehaviorSubject<T> {
  const subject = createSubject<T>(); // Use existing Subject implementation
  let latestValue: T = initialValue;  // Store the latest value separately

  const next = (value: T) => {
    latestValue = value;
    subject.next(value);
  };

  const overriddenSubscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>) => {
    const subscription = subject.subscribe(callbackOrReceiver);

    if (!subject.completed()) {
      if (typeof callbackOrReceiver === "function") {
        callbackOrReceiver(latestValue);
      } else {
        callbackOrReceiver?.next?.(latestValue);
      }
    }

    return subscription;
  };

  return {
    ...subject,
    name: "behaviorSubject",
    next,
    subscribe: overriddenSubscribe,
    value: () => latestValue,
  };
}
