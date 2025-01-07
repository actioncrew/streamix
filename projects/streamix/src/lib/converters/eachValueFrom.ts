import { Stream } from "../abstractions";

export async function* eachValueFrom<T>(stream: Stream<T>): AsyncGenerator<T> {
  let isCompleted = false;

  // Create an observable iterator
  const promiseQueue: Promise<T>[] = [];

  const subscription = stream.subscribe({
    next: (value: T) => {
      // Add each emitted value to the queue
      promiseQueue.push(Promise.resolve(value));
    },
    complete: () => {
      // Once complete, mark the stream as completed
      isCompleted = true;
    },
    error: (err: any) => {
      // Handle errors if needed
      throw err;
    }
  });

  try {
    // Continuously yield values as they are emitted
    while (!isCompleted || promiseQueue.length > 0) {
      // Await the next value from the queue
      const value = await promiseQueue.shift();
      if (value !== undefined) {
        yield value;
      }
    }
  } finally {
    // Ensure subscription cleanup when generator completes
    subscription.unsubscribe();
  }
}
