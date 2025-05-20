export type Subscription<T = any> = {
  (): Promise<T | undefined>;
  unsubscribed: boolean;
  hasValue(): Promise<boolean>;
  value(): Promise<T | undefined>;
  unsubscribe(): void;
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
    async hasValue() {
      return await this.value() === undefined;
    },
    async value() {
      return _latestValue!;
    },
    unsubscribe() {
      if (!_unsubscribed) {
        _unsubscribed = true;
        onUnsubscribe?.();
      }
    }
  });
};
