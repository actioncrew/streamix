import { createEmission, createStream, Stream } from "../abstractions";

export function fromEvent<T>(target: EventTarget, event: string): Stream<T> {
  return createStream("fromEvent", async function* ({ completed }) {
    let resolve: ((value: Event) => void) | null = null;

    // Event listener to push events into the queue and resolve the promise
    const listener = (ev: Event) => {
      if (resolve) {
        const tempResolve = resolve; // Store resolver before resetting
        resolve = null; // Reset before resolving (prevents race conditions)
        tempResolve(ev);
      }
    };

    // Add the event listener
    target.addEventListener(event, listener);

    try {
      while (!completed()) {
        yield createEmission({ value: await new Promise<Event>((r) => (resolve = r)) });
      }
    } finally {
      // Clean up the event listener
      target.removeEventListener(event, listener);
    }
  });
}
