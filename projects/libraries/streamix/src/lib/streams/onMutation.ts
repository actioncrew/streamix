import { Receiver, Stream } from '../abstractions';
import { createSubject } from '../subjects';

/**
 * Creates a stream that emits an array of `MutationRecord` objects whenever
 * a change is detected on a given DOM element.
 *
 * Automatically unsubscribes if the element is removed from the DOM.
 *
 * @param element The DOM element to observe for mutations.
 * @param options An optional object specifying which DOM changes to observe.
 * @returns A Stream emitting arrays of `MutationRecord`s.
 */
export function onMutation(
  element: Element,
  options?: MutationObserverInit
): Stream<MutationRecord[]> {
  const subject = createSubject<MutationRecord[]>();
  subject.name = 'onMutation';

  const originalSubscribe = subject.subscribe;
  subject.subscribe = (callback?: ((value: MutationRecord[]) => void) | Receiver<MutationRecord[]>) => {
    const subscription = originalSubscribe.call(subject, callback);

    const observer = new MutationObserver((mutations) => {
      subject.next([...mutations]);
    });

    observer.observe(element, options);

    // Watch for DOM removal
    const removalObserver = new MutationObserver(() => {
      if (!document.body.contains(element)) {
        subject.complete?.();
      }
    });
    removalObserver.observe(document.body, { childList: true, subtree: true });

    const cleanup = () => {
      observer.disconnect();
      removalObserver.disconnect();
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
