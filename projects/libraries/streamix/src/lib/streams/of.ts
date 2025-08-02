import { createStream, Stream } from '../abstractions';

/**
 * Creates a stream that emits a single value and then completes.
 *
 * This operator is useful for scenarios where you need to treat a static,
 * single value as a stream. It immediately yields the provided `value`
 * and then signals completion, which is a common pattern for creating a
 * "hot" stream from a predefined value.
 */
export function of<T = any>(value: T): Stream<T> {
  return createStream<T>('of', async function* () {
    yield value;
  });
}
