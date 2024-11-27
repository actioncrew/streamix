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
