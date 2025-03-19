
export type Subscription = {
  unsubscribed: boolean;
  unsubscribe(): void;
};

export const createSubscription = function (unsubscribe?: () => void): Subscription {

  return {
    unsubscribed: false,
    unsubscribe: unsubscribe ?? (function(this: Subscription) { this.unsubscribed = true; })
  } as Subscription
};
