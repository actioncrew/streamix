import { createEmission, createStream, Stream } from "../abstractions";

export function retry<T = any>(sourceStream: Stream<T>, maxRetries: number = 3, delay: number = 1000): Stream<T> {
  return createStream<T>("retry", async function* (this: Stream<T>) {
    let retryCount = 0;
    let subscription: Subscription | undefined;

    const subscribeToSource = () => {
      subscription = sourceStream.subscribe({
        next: (value: T) => {
          // Yield the value directly
          yield createEmission({ value });
        },
        error: (error: any) => {
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(() => {
              // Resubscribe to the source stream after the delay
              subscription?.unsubscribe();
              subscribeToSource();
            }, delay);
          } else {
            // Emit the error if max retries are exhausted
            yield createEmission({ error });
          }
        },
        complete: () => {
          // Mark the stream as completed
          yield createEmission({ completed: true });
        },
      });
    };

    // Initial subscription to the source stream
    subscribeToSource();
  });
}
