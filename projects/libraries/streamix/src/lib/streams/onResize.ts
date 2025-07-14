import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream that emits the width and height of the element whenever it resizes.
 *
 */
export function onResize(element: Element): Stream<{ width: number; height: number }> {
  return createStream('onResize', async function* () {
    let resolveNext: ((value: { width: number; height: number }) => void) | null = null;
    let isObserving = true;

    const listener = (entries: ResizeObserverEntry[]) => {
      if (!isObserving) return;

      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };

      if (resolveNext) {
        resolveNext({ width, height });
        resolveNext = null;
      }
    };

    const resizeObserver = new ResizeObserver(listener);
    resizeObserver.observe(element);

    try {
      // Optionally emit initial size immediately:
      const rect = element.getBoundingClientRect();
      yield { width: rect.width, height: rect.height };

      while (isObserving) {
        const size = await new Promise<{ width: number; height: number }>((resolve) => {
          resolveNext = resolve;
        });
        yield size;
      }
    } finally {
      isObserving = false;
      resizeObserver.unobserve(element);
      resizeObserver.disconnect();
    }
  });
}
