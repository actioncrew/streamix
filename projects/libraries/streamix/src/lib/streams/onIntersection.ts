import { Receiver, Stream } from '../abstractions';
import { createSubject } from '../subjects';

/**
 * Creates a stream that emits `true` when a given element enters the
 * viewport and `false` when it leaves.
 *
 * This operator is a wrapper around the `IntersectionObserver` API,
 * making it easy to create reactive streams for "lazy loading" or
 * triggering events when an element becomes visible. The stream will
 * emit a value each time the intersection status changes.
 *
 * @param {Element} element The DOM element to observe for intersection changes.
 * @param {IntersectionObserverInit} [options] Optional configuration for the observer, such as root, root margin, and threshold.
 * @returns {Stream<boolean>} A stream that emits `true` if the element is intersecting the viewport, and `false` otherwise.
 */
export function onIntersection(
  element: Element,
  options?: IntersectionObserverInit
): Stream<boolean> {
  const subject = createSubject<boolean>();
  subject.name = 'onIntersection';

  const originalSubscribe = subject.subscribe;
  subject.subscribe = (callback?: ((value: boolean) => void) | Receiver<boolean>) => {
    const subscription = originalSubscribe.call(subject, callback);

    const observer = new IntersectionObserver((entries) => {
      subject.next(entries[0]?.isIntersecting ?? false);
    }, options);

    observer.observe(element);

    const cleanup = () => {
      observer.unobserve(element);
      observer.disconnect();
      mutationObserver.disconnect();
      subscription.unsubscribe();
    };

    const mutationObserver = new MutationObserver(() => {
      if (!document.body.contains(element)) {
        subscription.unsubscribe();
        subject.complete?.();
      }
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const originalOnUnsubscribe = subscription.onUnsubscribe;
    subscription.onUnsubscribe = () => {
      originalOnUnsubscribe?.call(subscription);
      cleanup();
    };
    return subscription;
  };

  return subject;
}