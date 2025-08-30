import { createStream, PipelineContext, Stream } from '../abstractions';
import { eachValueFrom } from '../converters';

/**
 * Combines multiple streams by emitting an array of values,
 * only when all streams have emitted at least one value.
 *
 * After emitting, it waits for the next value from all streams.
 *
 * The stream completes when any of the input streams complete.
 * Errors from any stream propagate immediately.
 *
 * @template {readonly unknown[]} T - A tuple type representing the combined values from the streams.
 * @param { { [K in keyof T]: Stream<T[K]> } } streams - An array of streams to combine.
 * @returns {Stream<T>} A new stream that emits an array of values.
 */
export function zip<T extends readonly unknown[] = any[]>(
  streams: { [K in keyof T]: Stream<T[K]> },
  context?: PipelineContext
): Stream<T> {
  // Note: controller is currently unused for aborting from outside
  // You may want to expose it or remove if unused
  const controller = new AbortController();
  const signal = controller.signal;

  return createStream<T>('zip', async function* (): AsyncGenerator<T, void, unknown> {
    if (streams.length === 0) return;

    // Create async iterators for all streams
    const iterators = streams.map(s => eachValueFrom(s)[Symbol.asyncIterator]());

    // Buffers to hold emitted values per stream, typed per stream output
    const buffers: { [K in keyof T]: T[K][] } = streams.map(() => []) as any;

    // Track active streams count
    let activeCount = streams.length;

    try {
      while (activeCount > 0 && !signal.aborted) {
        // Request next value for buffers that are empty
        await Promise.all(iterators.map(async (it, i) => {
          if (buffers[i].length === 0) {
            const { done, value } = await it.next();
            if (done) {
              activeCount--;
            } else {
              buffers[i].push(value);
            }
          }
        }));

        // Check if all buffers have at least one value
        const canEmit = buffers.every(buffer => buffer.length > 0);
        if (canEmit) {
          // Yield one zipped tuple of values
          yield buffers.map(buffer => buffer.shift()!) as unknown as T;
        }

        // If any stream completed and we can't emit full tuple, end
        if (activeCount < streams.length && !canEmit) {
          break;
        }
      }
    } finally {
      // Cleanup iterators
      await Promise.all(
        iterators.map(it => it.return?.(undefined).catch(() => {}))
      );
    }
  }, context);
}
