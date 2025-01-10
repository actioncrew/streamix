import { createReceiver, createStream, flags, Receiver, Stream, Subscription } from '../abstractions';

// Function to create an EmptyStream
export const empty = <T = any>(): Stream<T> => {
  // Custom run function for the EmptyStream
  const stream = createStream<T>('EMPTY', async function(this: Stream<T>): Promise<void> {
    // Set the auto-completion flag
    this[flags].isAutoComplete = true;
  });

  const newStream =  (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);

    const subscription = () => undefined;

    Object.assign(subscription, {
      unsubscribed: false,
      unsubscribe: () => { /* No-op for EMPTY subscription */ },
      started: Promise.resolve(), // Immediately resolve started promise
      completed: Promise.resolve(), // Immediately resolve completed promise
    });

    receiver.complete && queueMicrotask(receiver.complete);

    return subscription as Subscription;
  }

  Object.defineProperty(newStream, 'name', { writable: true, enumerable: true, configurable: true });
  Object.assign(newStream, stream);
  newStream.subscribe = newStream;
  return newStream as unknown as Stream<T>;
};

// Export a singleton instance of EmptyStream
export const EMPTY = empty();
