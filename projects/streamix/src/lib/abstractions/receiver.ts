export type Receiver<T = any> = {
  next?: (value: T) => void;
  error?: (err: Error) => void;
  complete?: () => void;
};

export function isReceiver<T>(obj: any): obj is Receiver<T> {
  return (
    obj !== null && obj !== undefined &&
    typeof obj.next === 'function' &&
    typeof obj.error === 'function' &&
    typeof obj.complete === 'function'
  );
};

export function createReceiver<T>(callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Receiver<T> {
  if (typeof callbackOrReceiver === 'function') {
    // Wrap the callback into a `Receiver` object
    return { next: callbackOrReceiver };
  } else {
    // Use the provided Receiver or an empty object
    return callbackOrReceiver || {};
  }
}
