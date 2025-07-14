import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream that emits a single value and then completes.
 *
 * Equivalent to `Promise.resolve(value)` but as a stream.
 */
export function of<T = any>(value: T): Stream<T> {
  return createStream<T>('of', async function* () {
    yield value;
  });
}
