import { Receiver } from "../abstractions";

export type Subscription<T = any> = {
  (): T | undefined;
  unsubscribed: boolean;
  value(): T | undefined; // Stores the latest value received from the stream
  unsubscribe(): void;
  listen(generator: () => AsyncGenerator<T, void, unknown>, receiver: Required<Receiver<T>>): void;
};

export const createSubscription = function <T>(onUnsubscribe?: () => void): Subscription<T> {

  let _latestValue: T | undefined;
  let _unsubscribed = false;

  function subscription(this: Subscription<T>) {
    return this.value();
  };

  return Object.assign(subscription, {
    get unsubscribed() {
      return _unsubscribed;
    },
    value() {
      return _latestValue!;
    },
    unsubscribe() {
      if (!_unsubscribed) {
        _unsubscribed = true;
        onUnsubscribe?.(); // Call the cleanup handler if provided
      }
    },
    listen(generator: () => AsyncGenerator<T, void, unknown>, receiver: Required<Receiver<T>>) {
      if (_unsubscribed) {
        throw new Error("Cannot listen on an unsubscribed subscription.");
      }

      const asyncLoop = async () => {
        try {
          for await (const value of generator()) {
            _latestValue = value;
            receiver.next?.(value);
          }
        } catch (err: any) {
          receiver.error?.(err); // Call error handler in receiver
        } finally {
          receiver.complete?.(); // Ensure complete is always called
        }
      };

      // Start the async loop
      asyncLoop().catch((err) => {
        // Ensure that errors are caught and handled if they bubble up
        receiver.error?.(err);
      });
    },
  });
};
