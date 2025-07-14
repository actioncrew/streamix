import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream that emits a boolean indicating whether the element is intersecting the viewport.
 * Emits every time the intersection state changes.
 *
 * @param element - The DOM element to observe.
 * @param options - Optional configuration for `IntersectionObserver`.
 * @returns A stream of `true`/`false` based on intersection state.
 */
export function onIntersection(
  element: Element,
  options?: IntersectionObserverInit
): Stream<boolean> {
  return createStream<boolean>('onIntersection', async function* () {
    let resolveNext: ((value: boolean) => void) | null = null;
    let isObserving = true;

    const observer = new IntersectionObserver((entries) => {
      if (!isObserving) return;

      const isIntersecting = entries[0]?.isIntersecting ?? false;

      if (resolveNext) {
        resolveNext(isIntersecting);
        resolveNext = null;
      }
    }, options);

    observer.observe(element);

    try {
      while (isObserving) {
        const value = await new Promise<boolean>((resolve) => {
          resolveNext = resolve;
        });
        yield value;
      }
    } finally {
      isObserving = false;
      observer.unobserve(element);
      observer.disconnect();
    }
  });
}
