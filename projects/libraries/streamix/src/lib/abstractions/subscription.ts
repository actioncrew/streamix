import { StrictReceiver } from "../abstractions";

export type Subscription<T = any> = {
  (): Promise<T | undefined>;
  readonly unsubscribed: boolean;
  readonly hasValue: boolean;
  readonly value: T | undefined;
  unsubscribe(): void;
  listen(iterator: () => AsyncIterator<T>, receiver: StrictReceiver<T>): void;
};

export function createSubscription<T = any>(onUnsubscribe?: () => void): Subscription<T> {
  let _latestValue: T | undefined;
  let _unsubscribed = false;
  let _hasValue = false;

  const subscription = async (): Promise<T | undefined> => {
    return _latestValue;
  };

  const unsubscribe = (): void => {
    if (!_unsubscribed) {
      _unsubscribed = true;
      onUnsubscribe?.();
    }
  };

  const listen = (iterator: () => AsyncIterator<T>, receiver: StrictReceiver<T>): void => {
    if (_unsubscribed) {
      throw new Error("Cannot listen on an unsubscribed subscription.");
    }

    (async () => {
      try {
        const iter = iterator();
        while (!_unsubscribed) {
          const result = await iter.next();
          if (result.done || _unsubscribed) break;

          _latestValue = result.value;
          _hasValue = true;
          await receiver.next(_latestValue);
        }
        await receiver.complete();
      } catch (err: any) {
        await receiver.error(err instanceof Error ? err : new Error(String(err)));
      }
    })().catch((err) => {
      receiver.error(err instanceof Error ? err : new Error(String(err)));
    });
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
