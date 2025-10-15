import { Receiver, Stream } from '../abstractions';
import { createSubject } from '../subjects';

/**
 * Creates a stream that emits the dimensions (width and height) of a given
 * DOM element whenever it is resized.
 *
 * Automatically unsubscribes and completes if the element is removed from the DOM.
 *
 * @param element The DOM element to observe for size changes.
 * @returns A Stream emitting objects with `width` and `height` properties.
 */
export function onResize(element: HTMLElement): Stream<{ width: number; height: number }> {
  const subject = createSubject<{ width: number; height: number }>();
  subject.name = 'onResize';

  const originalSubscribe = subject.subscribe;
  subject.subscribe = (callback?: ((value: { width: number; height: number }) => void) | Receiver<{ width: number; height: number }>) => {
    const subscription = originalSubscribe.call(subject, callback);

    const listener = (entries: ResizeObserverEntry[]) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      subject.next({ width, height });
    };

    const resizeObserver = new ResizeObserver(listener);
    resizeObserver.observe(element);

    // Watch for DOM removal
    const removalObserver = new MutationObserver(() => {
      if (!document.body.contains(element)) {
        subject.complete?.();
      }
    });
    removalObserver.observe(document.body, { childList: true, subtree: true });

    const cleanup = () => {
      resizeObserver.unobserve(element);
      resizeObserver.disconnect();
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
