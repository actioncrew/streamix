import { createEmission, createStream, Stream } from "../abstractions";

export function fromEvent<T>(target: EventTarget, event: string, timeout = Infinity): Stream<T> {
  return createStream("fromEvent", async function* (this: Stream<T>) {
    let resolve: ((value: Event) => void) | null = null;

    const listener = (ev: Event) => {
      if (resolve) {
        const tempResolve = resolve;
        resolve = null; // Prevent race conditions
        tempResolve(ev);
      }
    };

    target.addEventListener(event, listener);

    try {
      while (!this.completed()) {
        const value = await new Promise<Event>((r) => (resolve = r));
        yield createEmission({ value });
      }
    } finally {
      target.removeEventListener(event, listener);
    }
  });
}
