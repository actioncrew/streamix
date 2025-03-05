import { createEmission, createStream, Stream } from '../abstractions';
import { createSemaphore } from '../utils';
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
    const itemAvailable = createSemaphore(0);
    let buffer: boolean | undefined;
    let eventsCaptured = 0;
    let eventsProcessed = 0;

    const callback = (entries: IntersectionObserverEntry[]) => {
      if (!this.completed()) {
        eventsCaptured++;
      }
      buffer = entries[0]?.isIntersecting ?? false;
      itemAvailable.release(); // Notify that a new event is available
    };

    const observer = new IntersectionObserver(callback, options);
    observer.observe(element);

    try {
      while (!(this.completed() && eventsCaptured === eventsProcessed)) {
        await itemAvailable.acquire(); // Wait for an event to be available

        if (buffer !== undefined) {
          yield createEmission({ value: buffer });
          eventsProcessed++;
        }
      }
    } finally {
      observer.unobserve(element);
      observer.disconnect();
    }
  });
}
