import { CallbackReturnType, createReceiver, createStream, Receiver, Stream, Subscription } from '../abstractions';

/**
 * Creates an empty stream that emits no values and completes immediately.
 *
 * - Useful as a placeholder or base case in stream compositions.
 * - The subscription completes immediately without emitting any values.
 */
export const empty = <T = any>(): Stream<T> => {
  const stream = createStream<T>('EMPTY', async function* (this: Stream<T>): AsyncGenerator<T> {
    // No emissions, just complete immediately
  });

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

// Export a singleton instance of EmptyStream
export const EMPTY = empty();
