export type Receiver<T = any> = {
  value?: () => T | undefined;
  next?: (value: T) => void;
  error?: (err: Error) => void;
  complete?: () => void;
  unsubscribed?: boolean;
  unsubscribe?: () => void;
};

export function createReceiver<T = any>(callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Required<Receiver<T>> {
  const receiver = (typeof callbackOrReceiver === 'function' ?
    { next: callbackOrReceiver } :
    callbackOrReceiver || {}) as Required<Receiver<T>>;

  let latestValue: T | undefined;


  receiver.unsubscribed = false;

  receiver.value = () => latestValue;

  const originalNext = receiver.next;
  receiver.next = (value: T) => { latestValue = value; originalNext?.call(receiver, value); }
  receiver.error = receiver.error ?? ((err) => console.error('Unhandled error:', err));
  receiver.complete = receiver.complete ?? (() => {});
  receiver.unsubscribe = receiver.unsubscribe ?? (function (this: Receiver) { this.unsubscribed = true; });

  return receiver;
}
