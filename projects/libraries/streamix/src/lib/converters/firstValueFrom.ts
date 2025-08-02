import { Stream, Subscription } from "../abstractions";

/**
 * Returns a promise that resolves with the first emitted value from a `Stream`.
 *
 * If the stream completes without emitting a value, the promise rejects.
 * Automatically unsubscribes after receiving the first value or error/completion.
 */
export function firstValueFrom<T = any>(stream: Stream<T>): Promise<T> {
  let subscription: Subscription;
  let seen = false;

  return new Promise<T>((resolve, reject) => {
    subscription = stream.subscribe({
      next(value: T) {
        seen = true;
        resolve(value);
        subscription.unsubscribe();
      },
      error(err: any) {
        reject(err);
        subscription.unsubscribe();
      },
      complete() {
        if (!seen) {
          reject(new Error("Stream completed without emitting a value"));
        }
        subscription.unsubscribe();
      }
    });
  });
}
