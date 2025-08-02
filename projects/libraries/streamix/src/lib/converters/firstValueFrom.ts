import { Stream, Subscription } from "../abstractions";

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
