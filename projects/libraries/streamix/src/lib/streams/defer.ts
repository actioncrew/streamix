import { createStream, Stream } from '../abstractions';
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

  return createStream<T>('defer', generator);
}
