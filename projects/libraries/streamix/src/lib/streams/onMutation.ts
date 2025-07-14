import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream of `MutationRecord[]` arrays for mutations observed on the element.
 */
export function onMutation(
  element: Element,
  options?: MutationObserverInit
): Stream<MutationRecord[]> {
  return createStream<MutationRecord[]>('onMutation', async function* () {
    let resolveNext: ((value: MutationRecord[]) => void) | null = null;
    let isObserving = true;

    const observer = new MutationObserver((mutations) => {
      if (!isObserving) return;

      if (resolveNext) {
        resolveNext([...mutations]); // emit a copy
        resolveNext = null;
      }
    });

    observer.observe(element, options);

    try {
      while (isObserving) {
        const mutations = await new Promise<MutationRecord[]>((resolve) => {
          resolveNext = resolve;
        });
        yield mutations;
      }
    } finally {
      isObserving = false;
      observer.disconnect();
    }
  });
}
