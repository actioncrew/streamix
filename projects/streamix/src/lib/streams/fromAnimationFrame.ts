import { createEmission, Emission, flags, internals } from '../abstractions';
import { createStream, Stream } from '../abstractions';
import { eventBus } from '../abstractions';

export function fromAnimationFrame<T>(
  initialValue: T,
  condition: (value: T) => boolean,
  iterateFn: (value: T, elapsedTime: number) => T
): Stream<T> {
  let currentValue = initialValue;
  let requestId: number | null = null;

  const stream = createStream<T>(async function (this: Stream<T>) {
    let lastFrameTime = performance.now();

    const runFrame = (currentTime: number) => {
      if (!condition(currentValue) || this[internals].shouldComplete()) {
        // Stop the loop and complete the stream
        if (requestId !== null) {
          cancelAnimationFrame(requestId);
        }
        if (!this[internals].shouldComplete()) {
          this[flags].isAutoComplete = true;
        }
        return;
      }

      // Calculate elapsed time since the last frame
      const elapsedTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;

      // Emit the current value
      const emission = createEmission({ value: currentValue }) as Emission;
      eventBus.enqueue({ target: this, payload: { emission, source: this }, type: 'emission' });

      // Update to the next value, passing elapsed time to iterateFn
      currentValue = iterateFn(currentValue, elapsedTime);

      // Schedule the next frame
      requestId = requestAnimationFrame(runFrame);
    };

    // Start the animation frame loop
    requestId = requestAnimationFrame(runFrame);
  });

  stream.name = "fromAnimationFrame";

  return stream;
}
