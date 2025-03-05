
export type Subscription = {
  (): any;
  subscribed: number;
  unsubscribed: number | undefined;
  unsubscribe(): void;
};

export const createSubscription = function <T>(getValue: () => T, unsubscribe?: () => void): Subscription {

  const subscription = () => getValue();

  unsubscribe = unsubscribe ?? (function(this: Subscription) { this.unsubscribed = performance.now(); });

  return Object.assign(subscription, {
    subscribed: performance.now(),
    unsubscribed: undefined,
    unsubscribe
  }) as any;
};
