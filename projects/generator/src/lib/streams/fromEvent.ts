import { createEmission, createStream, Stream } from "../abstractions";

export function fromEvent<T>(target: EventTarget, event: string, timeout = Infinity): Stream<T> {
  return createStream("fromEvent", async function* ({ completed }) {
    let resolve: ((value: Event | null) => void) | null = null;

    // Event listener to resolve the promise when an event occurs
    const listener = (ev: Event) => {
      if (resolve) {
        const tempResolve = resolve; // Store resolver before resetting
        resolve = null; // Prevent race conditions
        tempResolve(ev);
      }
    };

    target.addEventListener(event, listener);

    try {
      while (!completed()) {
        const eventOrTimeout = await new Promise<Event | null>((r) => {
          resolve = r; // Assign resolver

          // If timeout is set, resolve with `null` after the timeout
          if (timeout !== Infinity) {
            setTimeout(() => {
              if (resolve === r) resolve(null); // Avoid overriding if already resolved
            }, timeout);
          }
        });

        if (eventOrTimeout === null) continue; // Skip emissions on timeout
        yield createEmission({ value: eventOrTimeout });
      }
    } finally {
      target.removeEventListener(event, listener);
    }
  });
}
