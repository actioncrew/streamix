import { CallbackReturnType, StrictReceiver } from "../abstractions";

/**
 * Represents a subscription to a stream-like source.
 *
 * A subscription is an object returned from a stream's `subscribe` method. It is the
 * primary means for a consumer to manage their connection to the stream, allowing them
 * to listen for values and unsubscribe when they are no longer needed.
 *
 * @template T The type of the values emitted by the subscribed stream.
 */
export type Subscription<T = any> = {
  /**
   * A boolean flag indicating whether the subscription has been terminated.
   * A value of `true` means the subscription is no longer active and cannot
   * receive new values.
   */
  readonly unsubscribed: boolean;
  /**
   * Terminates the subscription and any associated listening process.
   *
   * Calling this method triggers any cleanup logic defined for the subscription.
   * It is idempotent, meaning calling it multiple times will not cause errors.
   *
   * @returns A `CallbackReturnType` which can be a `Promise<void>` if the cleanup
   * is asynchronous.
   */
  unsubscribe(): CallbackReturnType;
  /**
   * Binds the subscription to an asynchronous data source and a receiver.
   *
   * This method starts the flow of data. It pulls values from the `iterator` and
   * pushes them to the `receiver`, handling all lifecycle events. It will throw
   * an error if called on an already unsubscribed subscription.
   *
   * @param iterator A function that returns an `AsyncIterator` as the data source.
   * @param receiver The `StrictReceiver` to which stream events (next, error, complete)
   * will be delivered.
   * @returns A `Promise` that resolves when the listening process is complete.
   */
  listen(iterator: () => AsyncIterator<T>, receiver: StrictReceiver<T>): Promise<void>;
};

/**
 * Creates a new subscription with optional cleanup logic.
 *
 * This factory function initializes a `Subscription` object that manages its
 * own state. It provides a robust mechanism for a stream consumer to stop
 * listening for values and to perform custom teardown tasks.
 *
 * @template T The type of the values that the subscription will handle.
 * @param onUnsubscribe An optional callback function to be executed when the `unsubscribe`
 * method is called. This is useful for custom resource cleanup.
 * @returns A new `Subscription` instance.
 */
export function createSubscription<T = any>(
  onUnsubscribe?: () => CallbackReturnType
): Subscription<T> {
  let _unsubscribing = false;
  let _unsubscribed = false;

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
        await receiver.next(result.value);
      }
    } catch (err: unknown) {
      if (!_unsubscribed) {
        await receiver.error(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      await receiver.complete();
    }
  };

  return {
    get unsubscribed() {
      return _unsubscribed;
    },
    unsubscribe,
    listen,
  };
}
