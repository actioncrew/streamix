import { createStream, createSubscription, Receiver, Stream, Subscription } from '../abstractions';

export function loop<T>(
  initialValue: T,
  condition: (value: T) => boolean,
  iterateFn: (value: T) => T
): Stream<T> {
  let currentValue = initialValue;
  const abortController = new AbortController();
  const { signal } = abortController;

  // Create the stream with a custom run function using a generator
  const stream = createStream<T>('loop', async function* (this: Stream<T>): AsyncGenerator<T> {
    // Loop while condition is true and the stream is not completed
    while (condition(currentValue) && !signal.aborted) {
      // Create and yield the emission for the current value
      yield currentValue;

      // Update the value using the iterate function
      currentValue = iterateFn(currentValue);
    }
  });

  const originalSubscribe = stream.subscribe;
    stream.subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
      const subscription = originalSubscribe.call(stream, callbackOrReceiver);

      return createSubscription(() => stream.value(), () => {
        abortController.abort();
        subscription.unsubscribe();
      });
    };

    return stream;
}
