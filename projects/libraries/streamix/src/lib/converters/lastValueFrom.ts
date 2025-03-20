import { Stream } from "../abstractions";

export function lastValueFrom<T>(stream: Stream<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let lastValue: T | undefined;
    let hasValue = false;

    const subscription = stream.subscribe({
      next(value: T) {
        lastValue = value;
        hasValue = true;
      },
      error(err: any) {
        subscription.unsubscribe();
        reject(err);
      },
      complete() {
        subscription.unsubscribe();
        if (hasValue) {
          resolve(lastValue as T);
        } else {
          reject(new Error("Stream completed without emitting a value"));
        }
      }
    });
  });
}
