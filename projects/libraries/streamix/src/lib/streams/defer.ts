import { createStream, PipelineContext, Stream } from '../abstractions';
import { eachValueFrom } from '../converters';

/**
 * Creates a stream that defers the creation of an inner stream until it is
 * subscribed to.
 *
 * This operator ensures that the `factory` function is called only when
 * a consumer subscribes to the stream, making it a good choice for
 * creating "cold" streams. Each new subscription will trigger a new
 * call to the `factory` and create a fresh stream instance.
 *
 * @template T The type of the values in the inner stream.
 * @param {() => Stream<T>} factory A function that returns the stream to be subscribed to.
 * @returns {Stream<T>} A new stream that defers subscription to the inner stream.
 */
export function defer<T = any>(factory: () => Stream<T>, context?: PipelineContext): Stream<T> {
  async function* generator() {
    const innerStream = factory();

    try {
      const iterator = eachValueFrom<T>(innerStream);
      try {
        for await (const value of iterator) {
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

  return createStream<T>('defer', generator, context);
}
