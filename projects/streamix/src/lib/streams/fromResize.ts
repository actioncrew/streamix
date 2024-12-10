import { createEmission, hooks, internals, flags, createStream, Stream } from '../abstractions';
import { eventBus } from '../abstractions';

/**
 * Creates a custom stream that observes element resizing using ResizeObserver.
 * Emits an object containing the width and height of the observed element on each resize event.
 */
export function fromResize(
  element: Element
): Stream<{ width: number; height: number }> {
  const stream = createStream<{ width: number; height: number }>(async function (this: Stream<{ width: number; height: number }>) {
    let resizeObserver: ResizeObserver;

    const callback = (entries: ResizeObserverEntry[]) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      const emission = createEmission({ value: { width, height } });
      eventBus.enqueue({
        target: this,
        payload: { emission, source: this },
        type: 'emission',
      });
    };

    // Initialize ResizeObserver
    resizeObserver = new ResizeObserver(callback);

    // Start observing the provided DOM element
    resizeObserver.observe(element);

    await stream[internals].awaitCompletion();

    resizeObserver.unobserve(element);
    resizeObserver.disconnect();
  });

  stream.name = 'fromResizeObserver';
  return stream;
}
