import { createEmission, createStream, Stream } from '../abstractions';

/**
 * Creates a Stream using `MutationObserver` to observe DOM mutations.
 *
 * @param element - The DOM element to observe.
 * @param options - Optional configuration for `MutationObserver`.
 * @returns A Stream emitting mutation records when changes occur.
 */
export function onMutation(
  element: Element,
  options?: MutationObserverInit
): Stream<MutationRecord[]> {
  return createStream<MutationRecord[]>('onMutation', async function* (this: Stream<MutationRecord[]>) {
    let observer: MutationObserver;
    let completed = false;
    const queue: MutationRecord[][] = [];

    const callback = (mutations: MutationRecord[]) => {
      if (mutations.length) {
        queue.push([...mutations]); // Store mutation batch
      }
    };

    observer = new MutationObserver(callback);
    observer.observe(element, options);

    try {
      // Yield values from the queue as they become available
      while (!completed || queue.length > 0) {
        if (queue.length > 0) {
          yield createEmission({ value: queue.shift()! });
        } else {
          await new Promise(requestAnimationFrame); // Yield control and wait for new mutations
        }
      }
    } finally {
      observer.disconnect();
    }
  });
}
