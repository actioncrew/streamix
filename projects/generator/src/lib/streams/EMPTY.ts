import { createReceiver, createStream, Emission, Receiver, Stream, Subscription } from '../abstractions';

// Function to create an EmptyStream as a generator
export const empty = <T = any>(): Stream<T> => {
  // Custom run function for the EmptyStream using generator
  const stream = createStream<T>('EMPTY', async function* (this: Stream<T>): AsyncGenerator<Emission<T>> {
    // No emissions, just complete immediately
    return; // Empty generator, yields nothing
  });

  // Empty stream does not subscribe to any source
  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);

    // No data is emitted, immediately complete the receiver
    queueMicrotask(() => receiver.complete && receiver.complete());

    // Return a no-op subscription for EMPTY stream
    const subscription = () => undefined;
    Object.assign(subscription, {
      unsubscribed: false,
      unsubscribe: () => { /* No-op for EMPTY subscription */ },
    });

    return subscription as Subscription;
  };

  return Object.assign(stream, { subscribe });
};

// Export a singleton instance of EmptyStream
export const EMPTY = empty();
