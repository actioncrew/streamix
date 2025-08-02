import { Stream } from "../abstractions";

/**
 * Returns a promise that resolves with the last emitted value from a `Stream`.
 *
 * If the stream completes without emitting any value, the promise rejects.
 * Unsubscribes after completion or error.
 */
export function lastValueFrom<T = any>(stream: Stream<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let lastValue: T | undefined;
    let hasValue = false;

    const subscription = stream.subscribe({
      next(value: T) {
        lastValue = value;
        hasValue = true;
      },
      error(err: any) {
        reject(err);
        subscription.unsubscribe();
      },
      complete() {
        if (hasValue) {
          resolve(lastValue as T);
        } else {
          reject(new Error("Stream completed without emitting a value"));
        }
        subscription.unsubscribe();
      }
    });
  });
}
