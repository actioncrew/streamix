import { CallbackReturnType, createReceiver, createStream, PipelineContext, Receiver, Stream, Subscription } from '../abstractions';

/**
 * Creates an empty stream that emits no values and completes immediately.
 *
 * This function creates a stream that serves as a useful utility for
 * scenarios where a stream is expected but no values need to be produced.
 * It completes immediately upon subscription, allowing a sequence of
 * other streams to proceed without delay.
 *
 * @template T The type of the stream's values (will never be emitted).
 * @returns {Stream<T>} An empty stream.
 */
/**
 * A singleton instance of an empty stream.
 *
 * This constant provides a reusable, empty stream that immediately completes
 * upon subscription without emitting any values. It is useful in stream
 * compositions as a placeholder or to represent a sequence with no elements.
 *
 * @type {Stream<any>}
 */
export const empty = <T = any>(context?: PipelineContext): Stream<T> => {
  const stream = createStream<T>('EMPTY', async function* (this: Stream<T>): AsyncGenerator<T> {
    // No emissions, just complete immediately
  }, context);

  // Empty stream does not subscribe to any source
  const subscribe = (callbackOrReceiver?: ((value: T) => CallbackReturnType) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);

    // No data is emitted, immediately complete the receiver
    queueMicrotask(async () => receiver.complete && await receiver.complete());

    return {
      unsubscribed: false,
      unsubscribe: () => { /* No-op for EMPTY subscription */ },
    } as Subscription;
  };

  return Object.assign(stream, { subscribe, completed: () => true });
};

/**
 * A singleton instance of an empty stream.
 *
 * This constant provides a reusable, empty stream that immediately completes
 * upon subscription without emitting any values. It is useful in stream
 * compositions as a placeholder or to represent a sequence with no elements.
 */
export const EMPTY = empty();
