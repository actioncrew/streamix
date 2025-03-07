import { createSubscription, Receiver, Stream } from "../abstractions";
import { createSubject } from '../streams';

/**
 * Creates a stream from an event target, where events trigger emissions in the stream.
 *
 * @param target - The EventTarget (e.g., DOM element or window).
 * @param event - The event type (e.g., 'click', 'resize').
 * @returns A stream that emits the event when it occurs.
 */
export function fromEvent<T>(target: EventTarget, event: string): Stream<T> {
  const subject = createSubject<T>(); // Create a subject to emit event values.

  const originalSubscribe = subject.subscribe; // Capture original subscribe method.

  const subscribe = (callback?: ((value: T) => void) | Receiver<T>) => {
    const subscription = originalSubscribe.call(subject, callback);

    const listener = (ev: Event) => {
      if (!subject.completed()) {
        subject.next(ev as T); // Emit the event directly into the subject's stream
      }
    };

    target.addEventListener(event, listener);

    return createSubscription(subscription, () => {
      subscription.unsubscribe(); // Unsubscribe when done
      target.removeEventListener(event, listener); // Cleanup listener on unsubscribe
    });
  };

  subject.name = 'fromEvent';
  subject.subscribe = subscribe; // Override the subject's subscribe method

  return subject;
}
