import { Stream } from "../abstractions";

export function firstValueFrom<T>(stream: Stream<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const subscription = stream.subscribe({
      next(value: T) {
        resolve(value);
        subscription.unsubscribe(); // Stop listening after the first value
      },
      error(err: any) {
        reject(err);
      },
      complete() {
        reject(new Error("Stream completed without emitting a value"));
      }
    });
  });
}
