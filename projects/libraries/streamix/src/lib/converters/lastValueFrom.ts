import { Stream } from "../abstractions";

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
