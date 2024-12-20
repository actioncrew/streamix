import { createEmission, hooks, internals } from '../abstractions';
import { createStream, Stream } from '../abstractions';

export function onAnimationFrame<T>(): Stream<T> {
  let requestId: number | null = null;

  const stream = createStream<T>(async function (this: Stream<T>) {
    let lastFrameTime = performance.now();

    const runFrame = (currentTime: number) => {
      if (this[internals].shouldComplete()) {
        // Stop the loop and complete the stream
        if (requestId !== null) {
          cancelAnimationFrame(requestId);
        }

        return;
      }

      // Calculate elapsed time since the last frame
      const elapsedTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;

      // Emit the current value
      stream[hooks].onEmission.parallel({ emission: createEmission({ value: elapsedTime }), source: this });

      // Schedule the next frame
      requestId = requestAnimationFrame(runFrame);
    };

    // Start the animation frame loop
    requestId = requestAnimationFrame(runFrame);
    await stream[internals].awaitCompletion();
  });

  stream.name = "onAnimationFrame";

  return stream;
}
