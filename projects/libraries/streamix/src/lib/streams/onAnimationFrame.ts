import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream that emits the time delta between `requestAnimationFrame` calls.
 */
export function onAnimationFrame(): Stream<number> {
  return createStream<number>('onAnimationFrame', async function* () {
    let isRunning = true;
    let resolveNext: ((value: number) => void) | null = null;
    let lastTime = performance.now();
    let rafId: number | null = null;

    const tick = (now: number) => {
      if (!isRunning) return;

      const delta = now - lastTime;
      lastTime = now;

      if (resolveNext) {
        resolveNext(delta);
        resolveNext = null;
      }

      requestNextFrame();
    };

    const requestNextFrame = () => {
      rafId = requestAnimationFrame(tick);
    };

    requestNextFrame();

    try {
      while (isRunning) {
        const delta = await new Promise<number>((resolve) => {
          resolveNext = resolve;
        });
        yield delta;
      }
    } finally {
      isRunning = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    }
  });
}
