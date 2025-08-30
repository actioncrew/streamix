import { createStream, PipelineContext, Stream } from '../abstractions';

/**
 * Creates a stream that emits the current screen orientation, either
 * "portrait" or "landscape", whenever it changes.
 *
 * This stream provides a reactive way to handle changes in a device's
 * orientation, which is useful for adapting UI layouts, games, or
 * other interactive experiences.
 *
 * It emits the initial orientation immediately upon subscription and then
 * emits a new value each time the orientation changes. If the Screen Orientation
 * API is not supported by the environment, the stream will warn and complete immediately.
 *
 * @returns {Stream<"portrait" | "landscape">} A stream that emits a string indicating the screen's orientation.
 */
export function onOrientation(context?: PipelineContext): Stream<"portrait" | "landscape"> {
  return createStream<"portrait" | "landscape">('onOrientation', async function* () {
    if (
      typeof window === 'undefined' ||
      !window.screen?.orientation ||
      typeof window.screen.orientation.angle !== 'number'
    ) {
      console.warn("Screen orientation API is not supported in this environment");
      return;
    }

    const getOrientation = (): "portrait" | "landscape" =>
      window.screen.orientation.angle === 0 || window.screen.orientation.angle === 180
        ? "portrait"
        : "landscape";

    let resolveNext: ((value: "portrait" | "landscape") => void) | null = null;

    const listener = () => {
      resolveNext?.(getOrientation());
      resolveNext = null;
    };

    window.screen.orientation.addEventListener("change", listener);

    try {
      // Emit the initial orientation immediately
      yield getOrientation();

      while (true) {
        const next = await new Promise<"portrait" | "landscape">((resolve) => {
          resolveNext = resolve;
        });
        yield next;
      }
    } finally {
      window.screen.orientation.removeEventListener("change", listener);
    }
  }, context);
}
