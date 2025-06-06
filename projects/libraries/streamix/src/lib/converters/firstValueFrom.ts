import { Stream } from "../abstractions";

export function firstValueFrom<T>(stream: Stream<T>): Promise<T | undefined> {
  let subscription: ReturnType<Stream<T>["subscribe"]>;
  let seen = false;

  return new Promise<T | undefined>((resolve, reject) => {
    subscription = stream.subscribe({
      next(value: T) {
        seen = true;
        resolve(value);
        subscription.unsubscribe();
      },
      error(err: any) {
        subscription.unsubscribe();
        reject(err);
      },
      complete() {
        subscription.unsubscribe();
        if (!seen) {
          reject(new Error("Stream completed without emitting a value"));
        }
      }
    });
  });
}
