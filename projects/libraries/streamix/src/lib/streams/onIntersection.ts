import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream that emits a boolean indicating whether the element is intersecting the viewport.
 * Emits every time the intersection state changes.
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
