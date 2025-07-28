import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream that emits `"portrait"` or `"landscape"` whenever the screen orientation changes.
 *
 * - Uses the Screen Orientation API (`window.screen.orientation.angle`).
 * - Emits the current orientation immediately upon subscription.
 * - Emits subsequent values on orientation change events.
 * - Cleans up the event listener on stream completion.
 */
export function onOrientation(): Stream<"portrait" | "landscape"> {
  const controller = new AbortController();
  const signal = controller.signal;

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
      if (signal.aborted) return;
      resolveNext?.(getOrientation());
      resolveNext = null;
    };

    window.screen.orientation.addEventListener("change", listener);

    try {
      // Emit the initial orientation immediately
      yield getOrientation();

      while (!signal.aborted) {
        const next = await new Promise<"portrait" | "landscape">((resolve) => {
          resolveNext = resolve;
        });
        yield next;
      }
    } finally {
      window.screen.orientation.removeEventListener("change", listener);
    }
  });
}
