import { createSubscription, Receiver } from '../abstractions';
import { createSubject } from '../streams';

/**
 * Creates a subscription using `IntersectionObserver` to detect element visibility.
 *
 * @param element - The DOM element to observe.
 * @param options - Optional configuration for `IntersectionObserver`.
 * @returns A Subscription function that returns the latest intersection state.
 */
export function onIntersection(
  element: Element,
  options?: IntersectionObserverInit
) {
  const subject = createSubject<boolean>();
  let latestValue: boolean | undefined;

  const observer = new IntersectionObserver((entries) => {
    latestValue = entries[0]?.isIntersecting ?? false;
    subject.next(latestValue);
  }, options);

  observer.observe(element);

  const originalSubscribe = subject.subscribe;
  const subscribe = (callback?: ((value: boolean) => void) | Receiver<boolean>) => {
    const subscription = originalSubscribe.call(subject, callback);
    return createSubscription(subscription, () => {
      subscription.unsubscribe();
      observer.unobserve(element);
      observer.disconnect();
    });
  }

  subject.name = 'onIntersection';
  subject.subscribe = subscribe;

  return subject;
}
