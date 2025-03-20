export type Receiver<T = any> = {
  next?: (value: T) => void;
  error?: (err: Error) => void;
  complete?: () => void;
  completed?: boolean;
};

export function createReceiver<T = any>(callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Required<Receiver<T>> {
  const receiver = (typeof callbackOrReceiver === 'function' ?
    { next: callbackOrReceiver } :
    callbackOrReceiver || {}) as Required<Receiver<T>>;


  receiver.completed = false;


  const originalNext = receiver.next;
  const originalComplete = receiver.complete;

  receiver.next = function (this: Receiver, value: T) { originalNext?.call(this, value); }
  receiver.error = receiver.error ?? ((err) => console.error('Unhandled error:', err));
  receiver.complete = function (this: Receiver) { this.completed = true; originalComplete?.call(this); };

  return receiver;
}
