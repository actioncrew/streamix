import { createStream, PipelineContext, Stream } from '../abstractions';

/**
 * Creates a stream that emits `true` when a given element enters the
 * viewport and `false` when it leaves.
 *
 * This operator is a wrapper around the `IntersectionObserver` API,
 * making it easy to create reactive streams for "lazy loading" or
 * triggering events when an element becomes visible. The stream will
 * emit a value each time the intersection status changes.
 *
 * @param {Element} element The DOM element to observe for intersection changes.
 * @param {IntersectionObserverInit} [options] Optional configuration for the observer, such as root, root margin, and threshold.
 * @returns {Stream<boolean>} A stream that emits `true` if the element is intersecting the viewport, and `false` otherwise.
 */
export function onIntersection(
  element: Element,
  options?: IntersectionObserverInit,
  context?: PipelineContext
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
  }, context);
}
