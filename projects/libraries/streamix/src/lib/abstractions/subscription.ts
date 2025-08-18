import { CallbackReturnType } from "../abstractions";

/**
 * Represents a subscription to a stream-like source.
 *
 * A subscription is an object returned from a stream's `subscribe` method. It is the
 * primary means for a consumer to manage their connection to the stream, allowing them
 * to listen for values and unsubscribe when they are no longer needed.
 */
export type Subscription = {
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
export function createSubscription(
  onUnsubscribe?: () => CallbackReturnType
): Subscription {
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

  return {
    get unsubscribed() {
      return _unsubscribed;
    },
    unsubscribe
  };
}
