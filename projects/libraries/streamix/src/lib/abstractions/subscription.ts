import { Receiver, Stream } from "../abstractions";

export type Subscription = {
  unsubscribed: boolean;
  unsubscribe(): void;
  listen(stream: Stream, receiver: Required<Receiver>): void;
};

export const createSubscription = function (onUnsubscribe?: () => void): Subscription {

  return {
    unsubscribed: false,
    unsubscribe: (function(this: Subscription) { this.unsubscribed = true; onUnsubscribe?.(); })
  } as Subscription
};
