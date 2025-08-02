import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream that emits the dimensions (width and height) of a given
 * DOM element whenever it is resized.
 *
 * This stream is a reactive wrapper around the `ResizeObserver` API,
 * providing a way to respond to changes in an element's size, which is
 * especially useful for responsive layouts or dynamic components.
 */
export function onResize(element: Element): Stream<{ width: number; height: number }> {
  return createStream('onResize', async function* () {
    let resolveNext: ((value: { width: number; height: number }) => void) | null = null;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      resolveNext?.({ width, height });
      resolveNext = null;
    });

    observer.observe(element);

    try {
      const rect = element.getBoundingClientRect();
      yield { width: rect.width, height: rect.height };

      while (true) {
        const size = await new Promise<{ width: number; height: number }>((resolve) => {
          resolveNext = resolve;
        });
        yield size;
      }
    } finally {
      observer.unobserve(element);
      observer.disconnect();
    }
  });
}
