import { createEmission, Emission, flags, hooks, internals } from '../abstractions';
import { createStream, Stream } from '../abstractions';
import { eventBus } from '../abstractions';

/**
 * Creates a custom stream that observes element visibility using IntersectionObserver.
 * Emits boolean values on visibility changes.
 */
export function fromIntersection(
  element: Element,
  options?: IntersectionObserverInit
): Stream<boolean> {
  const stream = createStream<boolean>(async function (this: Stream<boolean>) {
    let observer: IntersectionObserver;

    // Define the callback for IntersectionObserver
    const callback = (entries: IntersectionObserverEntry[]) => {
      const isVisible = entries[0]?.isIntersecting ?? false; // Extract visibility status
      const emission = createEmission({ value: isVisible });
      eventBus.enqueue({
        target: this,
        payload: { emission, source: this },
        type: 'emission',
      });
    };

    // Initialize the IntersectionObserver
    observer = new IntersectionObserver(callback, options);

    // Start observing the provided DOM element
    observer.observe(element);

    await stream[internals].awaitCompletion();

    observer.unobserve(element);
    observer.disconnect();
  });

  stream.name = 'fromIntersection';
  return stream;
}
