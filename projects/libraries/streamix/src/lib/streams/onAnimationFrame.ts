import { createStream, PipelineContext, Stream } from '../abstractions';

/**
 * Creates a stream that emits the time elapsed between each animation frame.
 *
 * This is useful for building animations, games, or any time-based logic
 * that needs to be synchronized with the browser's rendering cycle. The stream
 * will emit a `number` representing the time in milliseconds since the last frame.
 *
 * @returns {Stream<number>} A stream that emits the delta time for each animation frame.
 */
export function onAnimationFrame(context?: PipelineContext): Stream<number> {
  return createStream<number>('onAnimationFrame', async function* () {
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
  }, context);
}
