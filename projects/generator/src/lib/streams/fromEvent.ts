import { createEmission, createStream, Stream } from "../abstractions";

export function fromEvent<T>(target: EventTarget, event: string): Stream<T> {
  return createStream("fromEvent", async function* () {
    const queue: T[] = [];

    const listener = (event: Event) => queue.push(event as unknown as T);
    target.addEventListener(event, listener);

    try {
      while (true) {
        if (queue.length > 0) {
          const value = queue.shift()!
          yield createEmission({ value });
        } else if (this.completed()) {
          break;
        } else {
          await new Promise(requestAnimationFrame);
        }
      }

      while (queue.length > 0) {
        yield createEmission({ value: queue.shift()! });
      }
    } finally {
      target.removeEventListener(event, listener);
    }
  });
}
