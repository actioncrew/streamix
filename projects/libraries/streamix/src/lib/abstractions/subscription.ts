import { Receiver } from "../abstractions";

export type Subscription<T = any> = {
  (): T | undefined;
  unsubscribed: boolean;
  value(): T | undefined;
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
        onUnsubscribe?.();
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
          receiver.error?.(err);
        } finally {
          receiver.complete?.();
        }
      };

      asyncLoop().catch((err) => {
        receiver.error?.(err);
      });
    },
  });
};
