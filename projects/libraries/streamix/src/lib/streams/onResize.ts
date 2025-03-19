import { createSubscription, Receiver } from '../abstractions';
import { createSubject } from '../streams';

/**
 * Creates a subscription using `ResizeObserver` to observe element size changes.
 *
 * @param element - The DOM element to observe for resizing.
 * @returns A Subscription function returning `{ width, height }` of the element.
 */
export function onResize(element: Element) {
  const subject = createSubject<{ width: number; height: number }>();

  const originalSubscribe = subject.subscribe;
  subject.subscribe = (callback?: ((value: { width: number; height: number; }) => void) | Receiver<{ width: number; height: number; }>) => {
    const subscription = originalSubscribe.call(subject, callback);

    let latestSize = { width: 0, height: 0 };

    const listener = (entries: ResizeObserverEntry[]) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      latestSize = { width, height };
      subject.next(latestSize);
    };

    const resizeObserver = new ResizeObserver(listener);
    resizeObserver.observe(element);

    return createSubscription(() => {
      subscription.unsubscribe();
      resizeObserver.unobserve(element);
      resizeObserver.disconnect();
    });
  }

  subject.name = 'onResize';
  return subject;
}
