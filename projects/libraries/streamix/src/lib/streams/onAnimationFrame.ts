import { createStream, createSubscription, Receiver, Stream, Subscription } from '../abstractions';

/**
 * Creates a stream that emits the time delta between `requestAnimationFrame` calls.
 */
export function onAnimationFrame(): Stream<number> {
  const controller = new AbortController();
  const signal = controller.signal;

  const stream = createStream<number>('onAnimationFrame', async function* () {
    let resolveNext: ((value: number) => void) | null = null;
    let lastTime = performance.now();
    let rafId: number | null = null;

    const tick = (now: number) => {
      if (signal.aborted) return;

      const delta = now - lastTime;
      lastTime = now;

      resolveNext?.(delta);
      resolveNext = null;

      requestNextFrame();
    };

    const requestNextFrame = () => {
      rafId = requestAnimationFrame(tick);
    };

    requestNextFrame();

    try {
      while (!signal.aborted) {
        const delta = await new Promise<number>((resolve) => {
          resolveNext = resolve;
        });
        yield delta;
      }
    } finally {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    }
  });

  const originalSubscribe = stream.subscribe;
  stream.subscribe = (callbackOrReceiver?: ((value: number) => void) | Receiver<number>): Subscription => {
    const subscription = originalSubscribe.call(stream, callbackOrReceiver);
    return createSubscription(() => {
      controller.abort();
      subscription.unsubscribe();
    });
  };

  return stream;
}
