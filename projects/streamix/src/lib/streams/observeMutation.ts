import { createEmission, internals } from '../abstractions';
import { createStream, Stream } from '../abstractions';
import { eventBus } from '../abstractions';

/**
 * Creates a Stream from `MutationObserver` for observing DOM mutations.
 * Uses eventBus for emissions.
 *
 * @param target - The DOM element to observe for mutations.
 * @param options - Options to configure `MutationObserver`.
 * @returns A reactive Stream that emits mutations when they occur.
 *
 * @example
 * // Example usage:
 * import { observeMutation } from './your-path';
 *
 * const mutationStream = observeMutation(document.body, { childList: true });
 *
 * const subscription = mutationStream.subscribe({
 *   next: (mutations) => {
 *     console.log('Mutations observed:', mutations);
 *   },
 * });
 */
export function observeMutation(
  element: Element,
  options?: MutationObserverInit
): Stream<MutationRecord[]> {
  const stream = createStream<MutationRecord[]>(async function (this: Stream<MutationRecord[]>) {
    const observer = new MutationObserver((mutationsList) => {
      if (mutationsList.length) {
        const emission = createEmission({ value: mutationsList });
        eventBus.enqueue({
          target: this,
          payload: { emission, source: this },
          type: 'emission',
        });
      }
    });

    observer.observe(element, options);

    await this[internals].awaitCompletion();
    observer.disconnect();
  });

  stream.name = 'observeMutation';
  return stream;
}
