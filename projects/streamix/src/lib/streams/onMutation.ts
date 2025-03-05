import { createSubject, createSubscription } from '../abstractions';

/**
 * Creates a subscription using `MutationObserver` to observe DOM mutations.
 *
 * @param element - The DOM element to observe.
 * @param options - Optional configuration for `MutationObserver`.
 * @returns A Subscription function that returns the latest mutation records.
 */
export function onMutation(
  element: Element,
  options?: MutationObserverInit
) {
  const subject = createSubject<MutationRecord[]>();
  let latestMutations: MutationRecord[] = [];

  const observer = new MutationObserver((mutations) => {
    latestMutations = [...mutations]; // Store latest mutations
    subject.next(latestMutations);
  });

  observer.observe(element, options);

  return createSubscription(() => subject.value(), () => {
    observer.disconnect();
    subject.complete();
  });
}
