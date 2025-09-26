import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream that emits the time delta between `requestAnimationFrame` calls.
 */
export function onAnimationFrame(): Stream<number> {
  const stream = createStream<number>('onAnimationFrame', async function* () {
    let resolveNext: ((value: number) => void) | null = null;
    let lastTime = performance.now();
    let rafId: number | null = null;

    const tick = (now: number) => {
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
      while (true) {
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
  
  return stream;
}
