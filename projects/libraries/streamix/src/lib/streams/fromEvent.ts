import { Receiver, Stream } from '../abstractions';
import { createSubject } from '../subjects';

/**
 * Creates a stream that emits events of the specified type from the given EventTarget.
 *
 * This function provides a reactive way to handle DOM events or other events,
 * such as mouse clicks, keyboard presses, or custom events. The stream
 * will emit a new event object each time the event is dispatched.
 *
 * @template {Event} T The type of the event to listen for. Defaults to a generic `Event`.
 * @param {EventTarget} target The event target to listen to (e.g., a DOM element, `window`, or `document`).
 * @param {string} event The name of the event to listen for (e.g., 'click', 'keydown').
 * @returns {Stream<T>} A stream that emits the event objects as they occur.
 */
export function fromEvent(target: EventTarget, event: string): Stream<Event> {
  const subject = createSubject<Event>(); // Create a subject to emit event values.

  const originalSubscribe = subject.subscribe; // Capture original subscribe method.
  subject.subscribe = (callback?: ((value: Event) => void) | Receiver<Event>) => {
    const subscription = originalSubscribe.call(subject, callback);

    const listener = (ev: Event) => {
      if (!subject.completed()) {
        subject.next(ev); // Emit the event directly into the subject's stream
      }
    };

    target.addEventListener(event, listener);

    const originalOnUnsubscribe = subscription.onUnsubscribe;
    subscription.onUnsubscribe = () => {
      originalOnUnsubscribe?.call(subscription);
      target.removeEventListener(event, listener); // Cleanup listener on unsubscribe
    };

    return subscription;
  };

  subject.name = 'fromEvent';
  return subject;
}
