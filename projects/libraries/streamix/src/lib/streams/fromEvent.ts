import { createStream, createSubscription, Receiver, Stream, Subscription } from '../abstractions';

export function fromEvent(target: EventTarget, event: string): Stream<Event> {
  const controller = new AbortController();
  const signal = controller.signal;

  async function* generator() {
    let eventQueue: Event[] = [];
    let resolveNext: ((event: Event) => void) | null = null;
    let isListening = true;

    const listener = (ev: Event) => {
      if (!isListening || signal.aborted) return;

      if (resolveNext) {
        resolveNext(ev);
        resolveNext = null;
      } else {
        eventQueue.push(ev);
      }
    };

    target.addEventListener(event, listener);

    try {
      while (isListening && !signal.aborted) {
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

  const stream = createStream('fromEvent', generator);

  // Override subscribe to abort on unsubscribe
  const originalSubscribe = stream.subscribe;
  stream.subscribe = (callbackOrReceiver?: ((value: Event) => void) | Receiver<Event>): Subscription => {
    const subscription = originalSubscribe.call(stream, callbackOrReceiver);

    return createSubscription(() => {
      controller.abort();
      subscription.unsubscribe();
    });
  };

  return stream;
}
