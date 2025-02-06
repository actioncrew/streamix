import { createEmission, createStream, Stream } from "../abstractions";
import { createSemaphore } from "../utils";

/**
 * Creates a Stream from `window.matchMedia` for reactive media query handling.
 *
 * @param mediaQueryString - The media query string to observe.
 * @returns A Stream that emits boolean values when media query matches change.
 */
export function onMediaQuery(mediaQueryString: string): Stream<boolean> {
  return createStream<boolean>("onMediaQuery", async function* (this: Stream<boolean>) {
    if (!window.matchMedia) {
      console.warn("matchMedia is not supported in this environment");
      return;
    }

    const mediaQueryList = window.matchMedia(mediaQueryString);
    const itemAvailable = createSemaphore(0);
    const spaceAvailable = createSemaphore(1);

    let buffer: boolean = mediaQueryList.matches; // Initial state
    let eventsCaptured = 0; // Track the number of events captured
    let eventsProcessed = 0; // Track the number of events processed

    const listener = (event: MediaQueryListEvent) => {
      if (!this.completed()) {
        eventsCaptured++; // Increment when a new event is captured
      }
      spaceAvailable.acquire().then(() => {
        buffer = event.matches; // Update the buffer with the new event value
        itemAvailable.release(); // Signal that the event is ready to be processed
      });
    };

    mediaQueryList.addEventListener("change", listener);

    try {
      while (!this.completed() || eventsCaptured > eventsProcessed) {
        await itemAvailable.acquire(); // Wait until an event is available

        if (eventsCaptured > eventsProcessed) {
          yield createEmission({ value: buffer }); // Emit the buffered event
          eventsProcessed++; // Mark the event as processed
          spaceAvailable.release(); // Allow space for a new event
        }
      }
    } finally {
      mediaQueryList.removeEventListener("change", listener); // Clean up the listener
    }
  });
}
