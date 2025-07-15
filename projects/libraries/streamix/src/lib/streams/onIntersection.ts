import { createStream, createSubscription, Receiver, Stream, Subscription } from '../abstractions';

/**
 * Creates a stream that emits a boolean indicating whether the element is intersecting the viewport.
 * Emits every time the intersection state changes.
 */
export function onIntersection(
  element: Element,
  options?: IntersectionObserverInit
): Stream<boolean> {
  const controller = new AbortController();
  const signal = controller.signal;

  const stream = createStream<boolean>('onIntersection', async function* () {
    let resolveNext: ((value: boolean) => void) | null = null;

    const observer = new IntersectionObserver((entries) => {
      if (signal.aborted) return;

      const isIntersecting = entries[0]?.isIntersecting ?? false;
      resolveNext?.(isIntersecting);
      resolveNext = null;
    }, options);

    observer.observe(element);

    try {
      while (!signal.aborted) {
        const value = await new Promise<boolean>((resolve) => {
          resolveNext = resolve;
        });
        yield value;
      }
    } finally {
      observer.unobserve(element);
      observer.disconnect();
    }
  });

  const originalSubscribe = stream.subscribe;
  stream.subscribe = (callbackOrReceiver?: ((value: boolean) => void) | Receiver<boolean>): Subscription => {
    const subscription = originalSubscribe.call(stream, callbackOrReceiver);
    return createSubscription(() => {
      controller.abort();
      subscription.unsubscribe();
    });
  };

  return stream;
}
