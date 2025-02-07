import { Stream } from "../abstractions";

export function lastValueFrom<T>(stream: Stream<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let lastValue: T | undefined;
    let hasValue = false;

    const subscription = stream.subscribe({
      next: (value) => {
        lastValue = value;
        hasValue = true;
      },
      error: (err) => reject(err),
      complete: () => {
        if (hasValue) {
          resolve(lastValue as T); // Resolve with the last emitted value
        } else {
          reject(new Error("Stream completed without emitting a value"));
        }
        subscription.unsubscribe();
      }
    });
  });
}
