import { createStream, createSubscription, Receiver, Stream, Subscription } from '../abstractions';
import { eachValueFrom } from '../converters';

export function iif<T = any>(
  condition: () => boolean,
  trueStream: Stream<T>,
  falseStream: Stream<T>
): Stream<T> {
  const controller = new AbortController();
  const signal = controller.signal;

  async function* generator(): AsyncGenerator<T, void, unknown> {
    // Evaluate condition lazily when the stream starts
    const sourceStream = condition() ? trueStream : falseStream;
    const asyncIterable = eachValueFrom(sourceStream);
    const iterator = asyncIterable[Symbol.asyncIterator]();

    try {
      while (!signal.aborted) {
        const result = await iterator.next();
        if (result.done) break;
        yield result.value;
      }
    } finally {
      // Ensure proper cleanup of the iterator
      if (iterator.return) {
        try {
          await iterator.return(undefined);
        } catch {
          // Ignore any errors during cleanup
        }
      }
    }
  }

  const stream = createStream('iif', generator);

  // Override subscribe to handle cleanup
  const originalSubscribe = stream.subscribe;
  stream.subscribe = (
    callbackOrReceiver?: ((value: T) => void) | Receiver<T>
  ): Subscription => {
    const subscription = originalSubscribe.call(stream, callbackOrReceiver);

    return createSubscription(() => {
      controller.abort();
      subscription.unsubscribe();
    });
  };

  return stream;
}
