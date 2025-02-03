import { createReceiver, createStream, flags, Receiver, Stream, Subscription } from '../abstractions';

// Function to create an EmptyStream
export const empty = <T = any>(): Stream<T> => {
  // Custom run function for the EmptyStream
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    // Set the auto-completion flag
    this[flags].isAutoComplete = true;
  });

  stream.subscribe =  (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
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

  stream.name = "EMPTY";
  return stream;
};

// Export a singleton instance of EmptyStream
export const EMPTY = empty();
