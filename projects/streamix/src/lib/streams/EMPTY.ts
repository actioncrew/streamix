import { Consumer, createStream, flags, Stream, Subscription } from '../abstractions';

// Function to create an EmptyStream
export const empty = <T = any>(): Stream<T> => {
  // Custom run function for the EmptyStream
  const stream = createStream<T>('EMPTY', async function(this: Stream<T>): Promise<void> {
    // Set the auto-completion flag
    this[flags].isAutoComplete = true;
  });

  const newStream =  (consumer: Consumer): Subscription => {

    const subscription = () => undefined;

    Object.assign(subscription, {
      unsubscribed: false,
      unsubscribe: () => { /* No-op for EMPTY subscription */ }
    });

    consumer.complete && queueMicrotask(consumer.complete);

    return subscription as Subscription;
  }

  Object.defineProperty(newStream, 'name', { writable: true, enumerable: true, configurable: true });
  Object.assign(newStream, stream);
  newStream.subscribe = newStream;
  return newStream as unknown as Stream<T>;
};

// Export a singleton instance of EmptyStream
export const EMPTY = empty();
