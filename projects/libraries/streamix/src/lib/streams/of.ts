import { createStream, PipelineContext, Stream } from '../abstractions';

/**
 * Creates a stream that emits a single value and then completes.
 *
 * This operator is useful for scenarios where you need to treat a static,
 * single value as a stream. It immediately yields the provided `value`
 * and then signals completion, which is a common pattern for creating a
 * "hot" stream from a predefined value.
 *
 * @template T The type of the value to be emitted.
 * @param {T} value The single value to emit.
 * @returns {Stream<T>} A new stream that emits the value and then completes.
 */
export function of<T = any>(value: T, context?: PipelineContext): Stream<T> {
  return createStream<T>('of', async function* () {
    yield value;
  }, context);
}
