import { Receiver } from "../abstractions";

export type Subscription<T = any> = {
  unsubscribed: boolean;
  latestValue: T | undefined;
  value(): T; // Stores the latest value received from the stream
  unsubscribe(): void;
  listen(generator: () => AsyncGenerator<T, void, unknown>, receiver: Required<Receiver<T>>): void;
};

export const createSubscription = function <T>(onUnsubscribe?: () => void): Subscription<T> {

  // Initialize the subscription object
  const subscription: Subscription<T> = {
    latestValue: undefined,
    unsubscribed: false,
    value() {
      return this.latestValue!;
    },
    unsubscribe() {
      if (!this.unsubscribed) {
        this.unsubscribed = true;
        onUnsubscribe?.(); // Call the cleanup handler if provided
      }
    },
    listen(generator: () => AsyncGenerator<T, void, unknown>, receiver: Required<Receiver<T>>) {
      if (this.unsubscribed) {
        throw new Error("Cannot listen on an unsubscribed subscription.");
      }

      const asyncLoop = async () => {
        try {
          for await (const value of generator()) {
            this.latestValue = value;
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
  };

  return subscription;
};
