export type CallbackReturnType = any | Promise<any>;

export type Receiver<T = any> = {
  next?: (value: T) => CallbackReturnType;
  error?: (err: Error) => CallbackReturnType;
  complete?: () => CallbackReturnType;
};

export type StrictReceiver<T = any> = Required<Receiver<T>> & { readonly completed: boolean; };

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
