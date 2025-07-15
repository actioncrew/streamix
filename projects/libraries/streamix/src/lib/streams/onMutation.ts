import { createStream, createSubscription, Receiver, Stream, Subscription } from '../abstractions';

/**
 * Creates a stream of `MutationRecord[]` arrays for mutations observed on the element.
 */
export function onMutation(
  element: Element,
  options?: MutationObserverInit
): Stream<MutationRecord[]> {
  const controller = new AbortController();
  const signal = controller.signal;

  const stream = createStream<MutationRecord[]>('onMutation', async function* () {
    let resolveNext: ((value: MutationRecord[]) => void) | null = null;

    const observer = new MutationObserver((mutations) => {
      if (signal.aborted) return;
      resolveNext?.([...mutations]); // emit a copy
      resolveNext = null;
    });

    observer.observe(element, options);

    try {
      while (!signal.aborted) {
        const mutations = await new Promise<MutationRecord[]>((resolve) => {
          resolveNext = resolve;
        });
        yield mutations;
      }
    } finally {
      observer.disconnect();
    }
  });

  const originalSubscribe = stream.subscribe;
  stream.subscribe = (callbackOrReceiver?: ((value: MutationRecord[]) => void) | Receiver<MutationRecord[]>): Subscription => {
    const subscription = originalSubscribe.call(stream, callbackOrReceiver);
    return createSubscription(() => {
      controller.abort();
      subscription.unsubscribe();
    });
  };

  return stream;
}
