import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream that emits an array of `MutationRecord` objects whenever
 * a change is detected on a given DOM element.
 *
 * This function provides a reactive wrapper around the browser's native
 * `MutationObserver` API, making it easy to respond to changes in the DOM,
 * such as a change in attributes, child nodes, or character data.
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
