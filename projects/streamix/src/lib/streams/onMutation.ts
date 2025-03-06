import { createSubscription, Receiver } from '../abstractions';
import { createSubject } from '../streams';

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

  const originalSubscribe = subject.subscribe;
  const subscribe = (callback?: ((value: MutationRecord[]) => void) | Receiver<MutationRecord[]>) => {
    const subscription = originalSubscribe.call(subject, callback);
    return createSubscription(subscription, () => {
      subscription.unsubscribe();
      observer.disconnect();
    });
  }

  subject.name = 'onMutation';
  subject.subscribe = subscribe;
  return subject;
}
