/**
 * Represents a value that can either be a synchronous return or a promise that
 * resolves to the value.
 *
 * This type is used to support both synchronous and asynchronous callbacks
 * within stream handlers, providing flexibility without requiring every
 * handler to be an async function.
 *
 * @template T The type of the value returned by the callback.
 */
export type CallbackReturnType<T = any> = T | Promise<T>;

/**
 * Defines a receiver interface for handling a stream's lifecycle events.
 *
 * A receiver is an object that can be passed to a stream's `subscribe` method
 * to handle the three primary events in a stream's lifecycle: `next` for
 * new values, `error` for stream errors, and `complete` when the stream has finished.
 *
 * All properties are optional, allowing you to subscribe only to the events you care about.
 *
 * @template T The type of the value handled by the receiver's `next` method.
 */
export type Receiver<T = any> = {
  /**
   * A function called for each new value emitted by the stream.
   * @param value The value emitted by the stream.
   */
  next?: (value: T) => CallbackReturnType;
  /**
   * A callback function that is invoked when a value is emitted as a *phantom*.
   *
   * A *phantom* value is a value that was produced by a stream or operator
   * but is considered suppressed, filtered, or skipped for normal consumption.
   * This allows receivers to be notified of these intermediate or discarded values
   * without treating them as actual emissions.
   *
   * @template T The type of the phantom value.
   * @param value The value emitted as a phantom by the stream.
   * @returns A value of type {@link CallbackReturnType}, typically ignored.
   */
  phantom?: (value: any) => CallbackReturnType;
  /**
   * A function called if the stream encounters an error.
   * @param err The error that occurred.
   */
  error?: (err: Error) => CallbackReturnType;
  /**
   * A function called when the stream has completed successfully and will emit no more values.
   */
  complete?: () => CallbackReturnType;
};

/**
 * A fully defined, state-aware receiver with guaranteed lifecycle handlers.
 *
 * This type extends the `Receiver` interface by making all handler methods
 * (`next`, `error`, and `complete`) required. It also includes a `completed`
 * property to track the receiver's state, preventing it from processing
 * new events after it has completed. This is an internal type used to ensure
 * robust handling of all stream events.
 *
 * @template T The type of the value handled by the receiver.
 */
export type StrictReceiver<T = any> = Required<Receiver<T>> & { readonly completed: boolean; };

/**
 * Normalizes a receiver input (a function or an object) into a strict,
 * fully-defined receiver.
 *
 * This factory function ensures that a consistent `StrictReceiver` object is
 * always returned, regardless of the input. It wraps the provided handlers
 * with logic that ensures events are not processed after completion and that
 * unhandled errors are logged.
 *
 * If the input is a function, it is treated as the `next` handler. If it's an
 * object, its `next`, `error`, and `complete` properties are used. If no input
 * is provided, a receiver with no-op handlers is created.
 *
 * @template T The type of the value handled by the receiver.
 * @param callbackOrReceiver An optional function to serve as the `next` handler,
 * or a `Receiver` object with one or more optional handlers.
 * @returns A new `StrictReceiver` instance with normalized handlers and completion tracking.
 */
export function createReceiver<T = any>(
  callbackOrReceiver?: ((value: T) => CallbackReturnType) | Receiver<T>
): StrictReceiver<T> {
  let _completed = false;

  // Create base receiver with proper typing
  const baseReceiver = {
    get completed() { return _completed; }
  } as { readonly completed: boolean; };

  // Normalize the input to always be a Receiver object
  const receiver = (typeof callbackOrReceiver === 'function'
    ? { ...baseReceiver, next: callbackOrReceiver }
    : callbackOrReceiver
      ? { ...baseReceiver, ...callbackOrReceiver }
      : baseReceiver) as Receiver<T>;

  const wrappedReceiver: StrictReceiver<T> = {
    /**
     * @inheritdoc
     */
    next: async (value: T) => {
      if (!_completed) {
        try {
          await receiver.next?.call(receiver, value);
        } catch (err) {
          await wrappedReceiver.error(err instanceof Error ? err : new Error(String(err)));
        }
      }
    },
    /**
     * @inheritdoc
     */
    phantom: async (value: any) => {
      if (!_completed) {
        try {
          await receiver.phantom?.call(receiver, value);
        } catch (err) {
          await wrappedReceiver.error(err instanceof Error ? err : new Error(String(err)));
        }
      }
    },
    /**
     * @inheritdoc
     */
    error: async function (err: Error) {
      if (!_completed) {
        try {
          await receiver.error?.call(receiver, err);
        } catch (e) {
          console.error('Unhandled error in error handler:', e);
        }
      }
    },
    /**
     * @inheritdoc
     */
    complete: async () => {
      if (!_completed) {
        _completed = true;
        try {
          await receiver.complete?.call(receiver);
        } catch (err) {
          console.error('Unhandled error in complete handler:', err);
        }
      }
    },
    /**
     * @inheritdoc
     */
    get completed() {
      return _completed;
    },
  };

  return wrappedReceiver;
}
