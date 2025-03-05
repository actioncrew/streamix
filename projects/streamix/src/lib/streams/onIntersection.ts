import { createSubject, createSubscription } from '../abstractions';

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

  return createSubscription(() => subject.value, () => {
    observer.unobserve(element);
    observer.disconnect();
    subject.complete();
  });
}
