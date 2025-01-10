import { createEmission, createStream, internals, Stream } from '../abstractions';

/**
 * Creates a Stream using `ResizeObserver` for observing element resizing.
 * Uses eventBus for emissions.
 *
 * @param element - The DOM element to observe for resizing.
 * @returns A reactive Stream that emits resize events with element size information.
 *
 * @example
 * // Example usage:
 * import { observeResize } from './your-path';
 *
 * const elementToObserve = document.getElementById('resizeMe');
 * const resizeStream = observeResize(elementToObserve);
 *
 * const subscription = resizeStream({
 *   next: (resizeEntry) => {
 *     console.log('Resize observed:', resizeEntry);
 *   },
 * });
 */
export function observeResize(
  element: Element
): Stream<{ width: number; height: number }> {
  const stream = createStream<{ width: number; height: number }>('observeResize', async function (this: Stream<{ width: number; height: number }>) {
    let resizeObserver: ResizeObserver;

    const callback = (entries: ResizeObserverEntry[]) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      const emission = createEmission({ value: { width, height } });
      this.next(emission);
    };

    // Initialize ResizeObserver
    resizeObserver = new ResizeObserver(callback);

    // Start observing the provided DOM element
    resizeObserver.observe(element);

    await stream[internals].awaitCompletion();

    resizeObserver.unobserve(element);
    resizeObserver.disconnect();
  });

  stream.name = 'observeResize';
  return stream;
}
