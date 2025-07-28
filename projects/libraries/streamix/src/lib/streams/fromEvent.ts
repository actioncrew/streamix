import { createStream, Stream } from '../abstractions';

export function fromEvent(target: EventTarget, event: string): Stream<Event> {
  async function* generator() {
    let eventQueue: Event[] = [];
    let resolveNext: ((event: Event) => void) | null = null;
    let isListening = true;

    const listener = (ev: Event) => {
      if (!isListening) return;

      if (resolveNext) {
        resolveNext(ev);
        resolveNext = null;
      } else {
        eventQueue.push(ev);
      }
    };

    target.addEventListener(event, listener);

    try {
      while (isListening) {
        if (eventQueue.length > 0) {
          yield eventQueue.shift()!;
        } else {
          const nextEvent = await new Promise<Event>((resolve) => {
            resolveNext = resolve;
          });
          yield nextEvent;
        }
      }
    } finally {
      isListening = false;
      target.removeEventListener(event, listener);
    }
  }

  return createStream('fromEvent', generator);
}
