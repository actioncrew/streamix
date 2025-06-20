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
      error = err;
      if (rejectNext) {
        rejectNext(err);
      }
      subscription.unsubscribe();
    },
    complete() {
      completed = true;
      if (resolveNext) {
        resolveNext(undefined);
      }
      subscription.unsubscribe();
    }
  });

  try {
    while (true) {
      if (queue.length > 0) {
        yield queue.shift()!;
      } else if (completed) {
        break;
      } else if (error) {
        throw error;
      } else {
        try {
          const nextValue = await new Promise<T | undefined>((resolve, reject) => {
            resolveNext = resolve;
            rejectNext = reject;
          });
          if (nextValue !== undefined) {
            yield nextValue;
          }
        } catch (err) {
          error = err;
          throw err;
        }
      }
    }
  } finally {
    subscription.unsubscribe();
  }
}
