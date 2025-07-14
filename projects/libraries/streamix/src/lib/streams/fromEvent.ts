import { createStream, Stream } from '../abstractions';

export function fromEvent(target: EventTarget, event: string): Stream<Event> {
  return createStream(
    'fromEvent',
    async function* () {
      let eventQueue: Event[] = [];
      let resolveNext: ((event: Event) => void) | null = null;
      let isListening = true;

      const listener = (ev: Event) => {
        if (!isListening) return;

        if (resolveNext) {
          // If someone is waiting for the next value, resolve immediately
          resolveNext(ev);
          resolveNext = null;
        } else {
          // Otherwise, queue the event
          eventQueue.push(ev);
        }
      };

      target.addEventListener(event, listener);

      try {
        while (isListening) {
          if (eventQueue.length > 0) {
            // If we have queued events, yield the first one
            yield eventQueue.shift()!;
          } else {
            // Wait for the next event
            const nextEvent = await new Promise<Event>((resolve) => {
              resolveNext = resolve;
            });
            yield nextEvent;
          }
        }
      } finally {
        target.removeEventListener(event, listener);
        isListening = false;
      }
    }
  );
}
