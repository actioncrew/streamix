import { Emission, Stream } from "../abstractions";

export async function* eachValueFrom<T>(stream: Stream<T>): AsyncGenerator<T> {
  let isCompleted = false;

  // Create an observable iterator
  const promiseQueue: Promise<T>[] = [];

  const subscription = stream({
    next: async (emission: Emission) => {
      // Add each emitted value to the queue
      if (emission.isOk()) {
        promiseQueue.push(Promise.resolve(emission.value));
      } else {
        stream.error(emission.error);
      }
    },
    complete: () => {
      // Once complete, mark the stream as completed
      isCompleted = true;
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
