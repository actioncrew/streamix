import { createStream, PipelineContext, Stream } from '../abstractions';

/**
 * Creates a stream that emits events of the specified type from the given EventTarget.
 *
 * This function provides a reactive way to handle DOM events or other events,
 * such as mouse clicks, keyboard presses, or custom events. The stream
 * will emit a new event object each time the event is dispatched.
 *
 * @template {Event} T The type of the event to listen for. Defaults to a generic `Event`.
 * @param {EventTarget} target The event target to listen to (e.g., a DOM element, `window`, or `document`).
 * @param {string} event The name of the event to listen for (e.g., 'click', 'keydown').
 * @returns {Stream<T>} A stream that emits the event objects as they occur.
 */
export function fromEvent<T extends Event = Event>(
  target: EventTarget,
  event: string,
  context?: PipelineContext
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

  return createStream<T>('fromEvent', generator, context);
}
