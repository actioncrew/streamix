import { CallbackReturnType, StrictReceiver } from "../abstractions";

export type Subscription<T = any> = {
  (): Promise<T | undefined>;
  readonly unsubscribed: boolean;
  readonly hasValue: boolean;
  readonly value: T | undefined;
  unsubscribe(): CallbackReturnType;
  listen(iterator: () => AsyncIterator<T>, receiver: StrictReceiver<T>): Promise<void>;
};

export function createSubscription<T = any>(
  onUnsubscribe?: () => CallbackReturnType
): Subscription<T> {
  let _latestValue: T | undefined;
  let _unsubscribing = false;
  let _unsubscribed = false;
  let _hasValue = false;

  const subscription = async (): Promise<T | undefined> => {
    return _latestValue;
  };

  const unsubscribe = async (): Promise<void> => {
    if (!_unsubscribing) {
      _unsubscribing = true;
      try {
        await onUnsubscribe?.();
        _unsubscribed = true;
      } catch (err) {
        console.error("Error during unsubscribe callback:", err);
      }
    }
  };

  const listen = async (iterator: () => AsyncIterator<T>, receiver: StrictReceiver<T>): Promise<void> => {
    if (_unsubscribed) {
      throw new Error("Cannot listen on an unsubscribed subscription.");
    }

    try {
      const iter = iterator();
      while (!_unsubscribed) {
        const result = await iter.next();
        if (result.done || _unsubscribed) break;

        _latestValue = result.value;
        _hasValue = true;
        await receiver.next(_latestValue);
      }
    } catch (err: unknown) {
      if (!_unsubscribed) {
        await receiver.error(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      await receiver.complete();
    }
  };

  return Object.assign(subscription, {
    get unsubscribed() {
      return _unsubscribed;
    },
    get hasValue() {
      return _hasValue;
    },
    get value() {
      return _latestValue;
    },
    unsubscribe,
    listen,
  });
}
