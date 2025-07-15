import { createStream, createSubscription, Receiver, Stream, Subscription } from '../abstractions';
import { eachValueFrom } from '../converters';

/**
 * Creates a stream that defers the creation of the inner stream
 * until the moment the stream is actually consumed (lazy initialization).
 *
 * - The `factory` function is called each time the stream is subscribed to.
 * - Useful for creating streams with side effects that should be delayed until use.
 */
export function defer<T = any>(factory: () => Stream<T>): Stream<T> {
  const controller = new AbortController();
  const signal = controller.signal;

  async function* generator() {
    const innerStream = factory();

    try {
      const iterator = eachValueFrom(innerStream);
      try {
        for await (const value of iterator) {
          if (signal.aborted) break;
          yield value;
        }
      } finally {
        if (iterator.return) {
          try {
            await iterator.return(undefined);
          } catch {
            // ignore
          }
        }
      }
    } catch (error) {
      throw error;
    }
  }

  const stream = createStream<T>('defer', generator);

  // Override subscribe to abort on unsubscribe
  const originalSubscribe = stream.subscribe;
  stream.subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const subscription = originalSubscribe.call(stream, callbackOrReceiver);

    return createSubscription(() => {
      controller.abort();
      subscription.unsubscribe();
    });
  };

  return stream;
}
