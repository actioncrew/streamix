import { createStream, Stream } from '../abstractions';

export function onOrientation(): Stream<"portrait" | "landscape"> {
  return createStream<"portrait" | "landscape">('onOrientation', async function* () {
    if (
      typeof window === 'undefined' ||
      !window.screen ||
      !window.screen.orientation ||
      typeof window.screen.orientation.angle !== 'number'
    ) {
      console.warn("Screen orientation API is not supported in this environment");
      return;
    }

    const getOrientation = () =>
      window.screen.orientation.angle === 0 || window.screen.orientation.angle === 180
        ? "portrait"
        : "landscape";

    let resolveNext: ((value: "portrait" | "landscape") => void) | null = null;
    let isActive = true;

    const listener = () => {
      if (!isActive) return;
      if (resolveNext) {
        resolveNext(getOrientation());
        resolveNext = null;
      }
    };

    window.screen.orientation.addEventListener("change", listener);

    try {
      // Emit initial orientation immediately
      yield getOrientation();

      while (isActive) {
        const nextOrientation = await new Promise<"portrait" | "landscape">((resolve) => {
          resolveNext = resolve;
        });
        yield nextOrientation;
      }
    } finally {
      isActive = false;
      window.screen.orientation.removeEventListener("change", listener);
    }
  });
}
