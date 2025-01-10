import { createEmission, createStream, internals, Stream } from '../abstractions';

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
 * const subscription = mutationStream({
 *   next: (mutations) => {
 *     console.log('Mutations observed:', mutations);
 *   },
 * });
 */
export function observeMutation(
  element: Element,
  options?: MutationObserverInit
): Stream<MutationRecord[]> {
  const stream = createStream<MutationRecord[]>('observeMutation', async function (this: Stream<MutationRecord[]>) {
    const observer = new MutationObserver((mutationsList) => {
      if (mutationsList.length) {
        const emission = createEmission({ value: mutationsList });
        this.next(emission);
      }
    });

    observer.observe(element, options);

    await this[internals].awaitCompletion();
    observer.disconnect();
  });

  return stream;
}
