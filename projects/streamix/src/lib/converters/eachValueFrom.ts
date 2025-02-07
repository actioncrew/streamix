import { Stream } from "../abstractions";

export async function* eachValueFrom<T>(stream: Stream<T>): AsyncGenerator<T> {
  let resolveNext: ((value: T) => void) | null = null;
  let rejectNext: ((err: any) => void) | null = null;
  let completed = false;

  const subscription = stream.subscribe({
    next: (value) => {
      if (resolveNext) {
        resolveNext(value); // Resolve the promise with the next value
      }
    },
    error: (err) => {
      if (rejectNext) {
        rejectNext(err); // Reject the promise if an error occurs
      }
    },
    complete: () => {
      completed = true; // Mark the stream as complete
      if (resolveNext) {
        resolveNext(undefined as any); // Resolve the promise to exit the loop
      }
    },
  });

  try {
    while (!completed) {
      // Create a new promise to wait for the next value
      yield await new Promise<T>((resolve, reject) => {
        resolveNext = resolve;
        rejectNext = reject;
      });
    }
  } catch (err) {
    // Propagate any errors from the stream
    throw err;
  } finally {
    subscription.unsubscribe(); // Clean up the subscription when done
  }
}
