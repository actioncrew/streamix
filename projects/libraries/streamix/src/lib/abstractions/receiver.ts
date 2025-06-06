export type Receiver<T = any> = {
  next?: (value: T) => void;
  error?: (err: Error) => void;
  complete?: () => void;
  completed?: boolean;
};

export function createReceiver<T = any>(
  callbackOrReceiver?: ((value: T) => void) | Receiver<T>
): Required<Receiver<T>> {
  const receiver =
    typeof callbackOrReceiver === 'function'
      ? { next: callbackOrReceiver }
      : callbackOrReceiver || {};

  let completed = false;

  const wrappedReceiver: Required<Receiver<T>> = {
    next: receiver.next?.bind(receiver) ?? (() => {}),
    error: receiver.error?.bind(receiver) ?? ((err) => console.error('Unhandled error:', err)),
    complete: () => {
      if (!completed) {
        completed = true;
        receiver.complete?.call(receiver);
      }
    },
    completed: false,
  };

  return wrappedReceiver;
}
