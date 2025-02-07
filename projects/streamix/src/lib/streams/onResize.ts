import { createEmission, createStream, Stream } from '../abstractions';
import { createSemaphore } from '../utils';

/**
 * Creates a Stream using `ResizeObserver` to observe element size changes.
 *
 * @param element - The DOM element to observe for resizing.
 * @returns A Stream emitting `{ width, height }` when the element resizes.
 */
export function onResize(
  element: Element
): Stream<{ width: number; height: number }> {
  return createStream<{ width: number; height: number }>('onResize', async function* (this: Stream<{ width: number; height: number }>) {
    const itemAvailable = createSemaphore(0); // Semaphore to signal when a resize event is ready to be processed
    const spaceAvailable = createSemaphore(1); // Semaphore to manage concurrent resize event handling

    let buffer: { width: number; height: number } | undefined; // Store the resize values
    let eventsCaptured = 0;
    let eventsProcessed = 0;

    const callback = (entries: ResizeObserverEntry[]) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      if (!this.completed()) {
        eventsCaptured++; // Increment when new resize events are captured
      }
      spaceAvailable.acquire().then(() => {
        buffer = { width, height }; // Store the resize dimensions in the buffer
        itemAvailable.release(); // Signal that a resize event is available
      });
    };

    const resizeObserver = new ResizeObserver(callback);
    resizeObserver.observe(element);

    try {
      while (!this.completed() || eventsCaptured > eventsProcessed) {
        await itemAvailable.acquire(); // Wait until a resize event is available

        if (eventsCaptured > eventsProcessed) {
          yield createEmission({ value: buffer! }); // Emit the buffered resize event
          eventsProcessed++; // Mark the event as processed
          spaceAvailable.release(); // Allow space for new resize events
        }
      }
    } finally {
      resizeObserver.unobserve(element); // Cleanup
      resizeObserver.disconnect();
    }
  });
}
