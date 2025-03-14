export type Receiver<T = any> = {
  next?: (value: T) => void;
  error?: (err: Error) => void;
  complete?: () => void;
  unsubscribed?: boolean;
};

export function createReceiver<T = any>(callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Required<Receiver<T>> {
  const receiver = (typeof callbackOrReceiver === 'function' ?
    { next: callbackOrReceiver } :
    callbackOrReceiver || {}) as Required<Receiver<T>>;

  receiver.next = receiver.next ?? (() => {});
  receiver.error = receiver.error ?? ((err) => console.error('Unhandled error:', err));
  receiver.complete = receiver.complete ?? (() => {});
  receiver.unsubscribed = false;

  return receiver;
}
