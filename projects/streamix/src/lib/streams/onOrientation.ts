import { createEmission, createStream, Stream } from "../abstractions";
import { createSemaphore } from "../utils";

/**
 * Creates a Stream that emits orientation changes.
 *
 * @returns A Stream that emits "portrait" or "landscape" when orientation changes.
 */
export function onOrientation(): Stream<"portrait" | "landscape"> {
  return createStream<"portrait" | "landscape">("onOrientation", async function* (this: Stream<"portrait" | "landscape">) {
    if (!window.screen || !window.screen.orientation) {
      console.warn("Screen orientation API is not supported in this environment");
      return;
    }

    const getOrientation = () =>
      window.screen.orientation.angle === 0 || window.screen.orientation.angle === 180
        ? "portrait"
        : "landscape";

    const itemAvailable = createSemaphore(0);
    const spaceAvailable = createSemaphore(1);

    let buffer: "portrait" | "landscape" = getOrientation(); // Initial orientation
    let eventsCaptured = 0;
    let eventsProcessed = 0;

    const listener = () => {
      if (!this.completed()) {
        eventsCaptured++;
      }
      spaceAvailable.acquire().then(() => {
        buffer = getOrientation();
        itemAvailable.release();
      });
    };

    window.screen.orientation.addEventListener("change", listener);

    try {
      while (!this.completed() || eventsCaptured > eventsProcessed) {
        await itemAvailable.acquire();

        if (eventsCaptured > eventsProcessed) {
          yield createEmission({ value: buffer });
          eventsProcessed++;
          spaceAvailable.release();
        }
      }
    } finally {
      window.screen.orientation.removeEventListener("change", listener);
    }
  });
}
