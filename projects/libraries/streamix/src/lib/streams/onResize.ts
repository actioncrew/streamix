import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream that emits the width and height of the element whenever it resizes.
 */
export function onResize(element: Element): Stream<{ width: number; height: number }> {
  const controller = new AbortController();
  const signal = controller.signal;

  return createStream('onResize', async function* () {
    let resolveNext: ((value: { width: number; height: number }) => void) | null = null;

    const observer = new ResizeObserver((entries) => {
      if (signal.aborted) return;
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      resolveNext?.({ width, height });
      resolveNext = null;
    });

    observer.observe(element);

    try {
      const rect = element.getBoundingClientRect();
      yield { width: rect.width, height: rect.height };

      while (!signal.aborted) {
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
