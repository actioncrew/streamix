import { createEmission, createStream, Stream } from '../abstractions';

/**
 * Creates a Stream using `IntersectionObserver` to detect element visibility.
 *
 * @param element - The DOM element to observe.
 * @param options - Optional configuration for `IntersectionObserver`.
 * @returns A Stream emitting `true` when visible and `false` when not.
 */
export function onIntersection(
  element: Element,
  options?: IntersectionObserverInit
): Stream<boolean> {
  return createStream<boolean>('onIntersection', async function* (this: Stream<boolean>) {
    let observer: IntersectionObserver;
    let completed = false;
    const queue: boolean[] = [];

    const callback = (entries: IntersectionObserverEntry[]) => {
      const isVisible = entries[0]?.isIntersecting ?? false;
      queue.push(isVisible);
    };

    observer = new IntersectionObserver(callback, options);
    observer.observe(element);

    try {
      // Yield values from the queue as they become available
      while (!completed || queue.length > 0) {
        if (queue.length > 0) {
          yield createEmission({ value: queue.shift()! });
        } else {
          await new Promise(requestAnimationFrame); // Yield control and wait for next value
        }
      }
    } finally {
      observer.unobserve(element);
      observer.disconnect();
    }
  });
}
