
export type Subscription<T = any> = {
  (): T;
  unsubscribed: boolean;
  unsubscribe(): void;
};

export const createSubscription = function <T>(getValue: () => T, unsubscribe?: () => void): Subscription {

  const subscription = () => getValue();

  unsubscribe = unsubscribe ?? (function(this: Subscription) { this.unsubscribed = true; });

  return Object.assign(subscription, {
    unsubscribed: false,
    unsubscribe
  }) as any;
};
