import { createSubscription } from '../abstractions';
import { createSubject } from '../streams';

/**
 * Creates a subscription using `ResizeObserver` to observe element size changes.
 *
 * @param element - The DOM element to observe for resizing.
 * @returns A Subscription function returning `{ width, height }` of the element.
 */
export function onResize(element: Element) {
  const subject = createSubject<{ width: number; height: number }>();
  let latestSize = { width: 0, height: 0 };

  const callback = (entries: ResizeObserverEntry[]) => {
    const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
    latestSize = { width, height };
    subject.next(latestSize);
  };

  const resizeObserver = new ResizeObserver(callback);
  resizeObserver.observe(element);

  return createSubscription(() => subject.value(), () => {
    resizeObserver.unobserve(element);
    resizeObserver.disconnect();
    subject.complete();
  });
}
