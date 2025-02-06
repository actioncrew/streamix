import { Stream } from "../abstractions";

export function firstValueFrom<T>(stream: Stream<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const subscription = stream.subscribe({
      next: (value) => {
        resolve(value); // Resolve with the first emitted value
        subscription.unsubscribe(); // Unsubscribe after receiving the first value
      },
      error: (err) => reject(err),
      complete: () => reject(new Error("Stream completed without emitting a value"))
    });
  });
}
