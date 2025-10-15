import { Receiver, Stream } from '../abstractions';
import { createSubject } from '../subjects';

/**
 * Creates a stream that emits the current screen orientation, either
 * "portrait" or "landscape", whenever it changes.
 *
 * Automatically unsubscribes when unsubscribed.
 *
 * @returns {Stream<"portrait" | "landscape">} A stream that emits a string indicating the screen's orientation.
 */

/**
 * Creates a stream that emits the current screen orientation, either
 * "portrait" or "landscape", whenever it changes.
 *
 * Automatically unsubscribes when unsubscribed.
 *
 * @returns {Stream<"portrait" | "landscape">} A stream that emits a string indicating the screen's orientation.
 */
export function onOrientation(): Stream<"portrait" | "landscape"> {
  if (!window.screen || !window.screen.orientation) {
    console.warn("Screen orientation API is not supported in this environment");
    return createSubject<"portrait" | "landscape">();
  }

  const subject = createSubject<"portrait" | "landscape">();
  subject.name = 'onOrientation';

  const getOrientation = () =>
    window.screen.orientation.angle === 0 || window.screen.orientation.angle === 180
      ? "portrait"
      : "landscape";

  const listener = () => {
    subject.next(getOrientation());
  };

  let subscriberCount = 0;
  let isListenerAttached = false;

  // Emit initial orientation immediately when first subscriber connects
  const originalSubscribe = subject.subscribe;
  subject.subscribe = (callback?: ((value: "portrait" | "landscape") => void) | Receiver<"portrait" | "landscape">) => {
    const subscription = originalSubscribe.call(subject, callback);

    subscriberCount++;
    
    // Attach listener on first subscriber
    if (!isListenerAttached) {
      window.screen.orientation.addEventListener("change", listener);
      isListenerAttached = true;
      // Emit initial orientation for new subscriber
      subject.next(getOrientation());
    }

    const cleanup = () => {
      subscriberCount--;
      
      // Remove listener when last subscriber unsubscribes
      if (subscriberCount === 0 && isListenerAttached) {
        window.screen.orientation.removeEventListener("change", listener);
        isListenerAttached = false;
      }
      
      subscription.unsubscribe();
    };

    const originalOnUnsubscribe = subscription.onUnsubscribe;
    subscription.onUnsubscribe = () => {
      originalOnUnsubscribe?.call(subscription);
      cleanup();
    };
    return subscription;
  };

  return subject;
}