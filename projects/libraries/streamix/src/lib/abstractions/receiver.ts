/**
 * Represents a value or a promise of that value.
 */
export type CallbackReturnType<T = any> = T | Promise<T>;

/**
 * Defines an optional receiver interface for handling stream events.
 * Includes handlers for `next`, `error`, and `complete` lifecycle events.
 */
export type Receiver<T = any> = {
  next?: (value: T) => CallbackReturnType;
  error?: (err: Error) => CallbackReturnType;
  complete?: () => CallbackReturnType;
};

/**
 * A fully defined and state-aware receiver with guaranteed lifecycle handlers.
 */
export type StrictReceiver<T = any> = Required<Receiver<T>> & { readonly completed: boolean; };

/**
 * Normalizes a receiver input (function or object) into a strict receiver
 * with lifecycle guarantees and internal completion tracking.
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
    next: async (value: T) => {
      if (!_completed) {
        try {
          await receiver.next?.call(receiver, value);
        } catch (err) {
          await wrappedReceiver.error(err instanceof Error ? err : new Error(String(err)));
        }
      }
    },
    error: async function (err: Error) {
      if (!_completed) {
        try {
          await receiver.error?.call(receiver, err);
        } catch (e) {
          console.error('Unhandled error in error handler:', e);
        }
      }
    },
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
    get completed() {
      return _completed;
    },
  };

  return wrappedReceiver;
}
