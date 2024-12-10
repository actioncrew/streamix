import { createEmission, Emission, flags, hooks, internals } from '../abstractions';
import { createStream, Stream } from '../abstractions';
import { eventBus } from '../abstractions';

/**
 * Creates a custom stream that observes DOM mutations using MutationObserver.
 * Emits mutation records when changes are detected.
 */
export function fromMutation(
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

  stream.name = 'fromMutation';
  return stream;
}
