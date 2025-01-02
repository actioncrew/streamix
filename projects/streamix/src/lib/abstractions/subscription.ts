import { Emission } from "./emission";

export interface Subscription {
  (): any;
  subscribed: number;
  unsubscribed: number | undefined;
  started?: Promise<void>;
  completed?: Promise<void>;
  unsubscribe(): void;
}

export const createSubscription = function (getValue: () => Emission, unsubscribe?: () => void): Subscription {
  let currentValue: Emission | undefined = undefined;

  const subscription = () => {
    const emission = getValue();

    if (!(emission.failed || emission.pending || emission.phantom)) {
      currentValue = emission;
    }

    return currentValue?.value;
  };

  unsubscribe = unsubscribe ?? (function(this: Subscription) { this.unsubscribed = performance.now(); });

  return Object.assign(subscription, {
    subscribed: performance.now(),
    unsubscribed: undefined,
    unsubscribe
  }) as any;
};
