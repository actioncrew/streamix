import { createStream, createSubscription, Receiver, Stream, Subscription } from '../abstractions';
import { eachValueFrom } from '../converters';

/**
 * Combines multiple streams by emitting an array of latest values,
 * but only emits when all streams have emitted at least once.
 *
 * After emitting, it waits for the next batch of values from all streams again.
 *
 * Completes when any stream completes.
 * Errors propagate immediately.
 */
export function zip(streams: Stream<any>[]): Stream<any[]> {
  const controller = new AbortController();
  const signal = controller.signal;

  const stream = createStream<any[]>('zip', async function* () {
    if (streams.length === 0) {
      return;
    }

    // Create async iterators for all streams
    const iterators = streams.map(s => eachValueFrom(s)[Symbol.asyncIterator]());

    // Buffers for each stream's values
    const buffers: any[][] = streams.map(() => []);

    // Track active streams
    let activeCount = streams.length;

    try {
      while (activeCount > 0 && !signal.aborted) {
        // Request next values from all streams that need them
        const requests = iterators.map(async (it, i) => {
          if (buffers[i].length === 0 && it.next) {
            const { done, value } = await it.next();
            if (done) {
              activeCount--;
            } else {
              buffers[i].push(value);
            }
          }
        });

        await Promise.all(requests);

        // Check if we can emit a zipped value
        const canEmit = buffers.every(buffer => buffer.length > 0);
        if (canEmit) {
          yield buffers.map(buffer => buffer.shift()!);
        }

        // If any stream is done and we can't emit, break
        if (activeCount < streams.length && !canEmit) {
          break;
        }
      }
    } finally {
      // Cleanup iterators
      await Promise.all(
        iterators.map(it => it.return?.(undefined).catch(() => { /* ignore errors */ }))
      );
    }
  });

  // Override subscribe to abort on unsubscribe
  const originalSubscribe = stream.subscribe;
  stream.subscribe = (callbackOrReceiver?: ((value: any[]) => void) | Receiver<any[]>): Subscription => {
    const subscription = originalSubscribe.call(stream, callbackOrReceiver);

    return createSubscription(() => {
      controller.abort();
      subscription.unsubscribe();
    });
  };

  return stream;
}
