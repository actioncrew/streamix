import { Stream } from "../abstractions";

export async function* eachValueFrom<T = any>(stream: Stream<T>): AsyncGenerator<T> {
  let resolveNext: ((value: T | undefined) => void) | null = null;
  let rejectNext: ((error: any) => void) | null = null;
  let completed = false;
  let error: any = null;
  const queue: T[] = [];

  const subscription = stream.subscribe({
    next(value: T) {
      if (resolveNext) {
        resolveNext(value);
        resolveNext = null;
      } else {
        queue.push(value);
      }
    },
    error(err: any) {
      error = err;  // Capture the error
      if (rejectNext) {
        rejectNext(err); // Reject the waiting promise
      }
      // Don't throw here - let the generator handle it
    },
    complete() {
      completed = true;
      if (resolveNext) {
        resolveNext(undefined);
      }
    }
  });

  try {
    while (!completed || queue.length > 0) {
      // Check for error before each iteration
      if (error) {
        throw error; // Properly throw from within the generator
      }

      if (queue.length > 0) {
        yield queue.shift()!;
      } else if (!completed) {
        try {
          const nextValue = await new Promise<T | undefined>((resolve, reject) => {
            resolveNext = resolve;
            rejectNext = reject;
          });

          if (nextValue !== undefined) {
            yield nextValue;
          }
        } catch (err) {
          // This handles errors rejected through rejectNext
          error = err;
          throw error;
        }
      }
    }
  } finally {
    subscription.unsubscribe();
    if (error) {
      throw error; // Properly throw from within the generator
    }
  }
}
