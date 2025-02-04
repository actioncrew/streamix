import { createEmission, createStream, Stream } from "../abstractions";

export function fromEvent<T>(target: EventTarget, event: string, timeout = Infinity): Stream<T> {
  return createStream("fromEvent", async function* (this: Stream<T>) {
    let resolve: ((value: Event) => void) | null = null;

    const listener = (ev: Event) => {
      if (resolve) {
        resolve(ev);
        resolve = null; // Prevent race conditions
      }
    };

    target.addEventListener(event, listener);

    try {
      while (!this.completed()) {
        const eventPromise = new Promise<Event>((r) => (resolve = r));

        const eventOrTimeout = timeout === Infinity
          ? await eventPromise
          : await Promise.race([
              eventPromise,
              new Promise<Event>((_, reject) =>
                setTimeout(() => reject(new Error("timeout")), timeout)
              ),
            ]).catch(() => null); // Convert timeout rejection to `null`

        if (eventOrTimeout) {
          yield createEmission({ value: eventOrTimeout });
        }
      }
    } finally {
      target.removeEventListener(event, listener);
    }
  });
}
