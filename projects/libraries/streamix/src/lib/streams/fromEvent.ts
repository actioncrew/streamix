import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream that emits events of the specified type from the given EventTarget.
 */
export function fromEvent<T extends Event = Event>(
  target: EventTarget,
  event: string
): Stream<T> {
  async function* generator() {
    let eventQueue: T[] = [];
    let resolveNext: ((event: T) => void) | null = null;
    let isListening = true;

    const listener = (ev: Event) => {
      if (!isListening) return;

      const typedEvent = ev as T;

      if (resolveNext) {
        resolveNext(typedEvent);
        resolveNext = null;
      } else {
        eventQueue.push(typedEvent);
      }
    };

    target.addEventListener(event, listener);

    try {
      while (isListening) {
        if (eventQueue.length > 0) {
          yield eventQueue.shift()!;
        } else {
          const nextEvent = await new Promise<T>((resolve) => {
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

  return createStream<T>('fromEvent', generator);
}
