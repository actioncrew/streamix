import { CallbackReturnType, createStream, createSubscription, Receiver, Stream, Subscription } from '../abstractions';

export function onAnimationFrame(): Stream<number> {
  const abortController = new AbortController();
  const { signal } = abortController;

  const stream = createStream<number>('onAnimationFrame', async function* (this: Stream<number>) {
    let lastFrameTime = performance.now();

    while (!signal.aborted) {
      const currentTime = await new Promise<number>((resolve) =>
        requestAnimationFrame(resolve)
      );

      const elapsedTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;

      yield elapsedTime;
    }
  });

  const originalSubscribe = stream.subscribe;
  stream.subscribe = (callbackOrReceiver?: ((value: number) => CallbackReturnType) | Receiver<number>): Subscription => {
    const subscription = originalSubscribe.call(stream, callbackOrReceiver);

    return createSubscription(() => {
      abortController.abort();
      subscription.unsubscribe();
    });
  };

  return stream;
}
