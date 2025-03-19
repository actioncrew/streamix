import { createStream, createSubscription, Receiver, Stream, Subscription } from '../abstractions';

export function timer(delayMs: number = 0, intervalMs?: number): Stream<number> {
  let timerValue = 0;
  const actualIntervalMs = intervalMs ?? delayMs;

  // Create an AbortController to manage cancellation
  const abortController = new AbortController();
  const { signal } = abortController;

  const stream = createStream<number>('timer', async function* (this: Stream) {
    // Initial delay if specified
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } else {
      await Promise.resolve();
    }

    if (!signal.aborted) {
      // Emit the first value immediately
      yield timerValue++;
    }

    // Emit subsequent values at intervals
    while (!signal.aborted) {
      await new Promise(resolve => setTimeout(resolve, actualIntervalMs));

      if (!signal.aborted) {
        yield timerValue++;
      }
    }
  });

  const originalSubscribe = stream.subscribe;
  stream.subscribe = (callbackOrReceiver?: ((value: number) => void) | Receiver<number>): Subscription => {
    const subscription = originalSubscribe.call(stream, callbackOrReceiver);

    return createSubscription(() => stream.value(), () => {
      abortController.abort();
      subscription.unsubscribe();
    });
  };
  return stream;
}
