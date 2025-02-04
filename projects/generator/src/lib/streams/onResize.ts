import { createEmission, createStream, Stream } from '../abstractions';

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
    let resizeObserver: ResizeObserver;
    let completed = false;
    const queue: { width: number; height: number }[] = [];

    const callback = (entries: ResizeObserverEntry[]) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      queue.push({ width, height });
    };

    resizeObserver = new ResizeObserver(callback);
    resizeObserver.observe(element);

    try {
      // Yield values from the queue as they become available
      while (!completed || queue.length > 0) {
        if (queue.length > 0) {
          yield createEmission({ value: queue.shift()! });
        } else {
          await new Promise(requestAnimationFrame); // Yield control and wait for next resize
        }
      }
    } finally {
      resizeObserver.unobserve(element);
      resizeObserver.disconnect();
    }
  });
}
