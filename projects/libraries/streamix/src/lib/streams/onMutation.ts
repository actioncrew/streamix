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

    const observer = new MutationObserver((mutations) => {
      resolveNext?.([...mutations]); // emit a copy
      resolveNext = null;
    });

    observer.observe(element, options);

    try {
      while (true) {
        const mutations = await new Promise<MutationRecord[]>((resolve) => {
          resolveNext = resolve;
        });
        yield mutations;
      }
    } finally {
      observer.disconnect();
    }
  });
}
