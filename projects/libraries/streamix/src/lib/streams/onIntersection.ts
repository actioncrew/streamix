import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream that emits `true` when a given element enters the
 * viewport and `false` when it leaves.
 *
 * This operator is a wrapper around the `IntersectionObserver` API,
 * making it easy to create reactive streams for "lazy loading" or
 * triggering events when an element becomes visible.
 */
export function onIntersection(
  element: Element,
  options?: IntersectionObserverInit
): Stream<boolean> {
  return createStream<boolean>('onIntersection', async function* () {
    let resolveNext: ((value: boolean) => void) | null = null;

    const observer = new IntersectionObserver((entries) => {
      const isIntersecting = entries[0]?.isIntersecting ?? false;
      resolveNext?.(isIntersecting);
      resolveNext = null;
    }, options);

    observer.observe(element);

    try {
      while (true) {
        const value = await new Promise<boolean>((resolve) => {
          resolveNext = resolve;
        });
        yield value;
      }
    } finally {
      observer.unobserve(element);
      observer.disconnect();
    }
  });
}
