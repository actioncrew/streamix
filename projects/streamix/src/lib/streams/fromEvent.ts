import { createSubscription, Receiver, Stream } from "../abstractions";
import { createSubject } from '../streams';

export function fromEvent(target: EventTarget, event: string): Stream<Event> {
  const subject = createSubject<Event>(); // Create a subject to emit event values.

  const originalSubscribe = subject.subscribe; // Capture original subscribe method.
  const subscribe = (callback?: ((value: Event) => void) | Receiver<Event>) => {
    const subscription = originalSubscribe.call(subject, callback);

    const listener = (ev: Event) => {
      if (!subject.completed()) {
        subject.next(ev); // Emit the event directly into the subject's stream
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
